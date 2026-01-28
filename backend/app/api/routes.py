from flask import Blueprint, current_app, jsonify, request

from ..adapters.ldap_client import LDAPClient
from ..core.auth import issue_token, verify_token
from ..services.otp_service import create_secret, enable_secret, get_secret, verify_code
from ..services.audit_service import list_logs, write_log
from ..services.audit_export import export_csv
from ..services.sms_service import (
    can_send,
    create_code,
    mark_failed,
    mark_sent,
    list_sms,
    retry_pending,
    verify_code as verify_sms_code,
    send_via_aliyun,
)
from ..services.password_expiry import trigger_password_expiry_check
from ..services.notify_service import list_expiry_notifies
from ..services.auth_service import clear_fail, is_locked, record_fail
from ..services.config_service import get_config, set_config, list_history, rollback
from ..services.email_service import create_code as create_email_code, verify_code as verify_email_code, send_email
from ..services.health_service import check_db, check_ldap
from ..core.config import apply_overrides
from ..services.sms_retry import start_sms_retry_loop
from ..services.password_expiry import start_password_expiry_loop
from ..core.errors import ADConnectionError

api_bp = Blueprint("api", __name__)

OTP_TOKEN_TTL = 300


def _ldap_client() -> LDAPClient:
    return LDAPClient(
        url=current_app.config["LDAP_URL"],
        bind_dn=current_app.config["LDAP_BIND_DN"],
        bind_password=current_app.config["LDAP_BIND_PASSWORD"],
        base_dn=current_app.config["LDAP_BASE_DN"],
        ca_cert=current_app.config["LDAP_CA_CERT"],
    )


def _get_bearer_token() -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth.replace("Bearer ", "", 1).strip()
    return ""

def _require_session(required_role: str | None = None) -> dict | None:
    token = _get_bearer_token()
    if not token:
        return None
    data = verify_token(current_app.config["APP_SECRET"], token, current_app.config["SESSION_TTL"])
    if not data or data.get("type") != "session":
        return None
    if required_role and data.get("role") != required_role:
        return None
    return data


def _audit(
    actor_info: dict,
    action: str,
    target: str,
    result: str,
    detail: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
) -> None:
    write_log(
        current_app.config["DB_URL"],
        actor=actor_info.get("username", ""),
        actor_role=actor_info.get("role", ""),
        action=action,
        target=target,
        result=result,
        ip=request.remote_addr or "",
        ua=request.headers.get("User-Agent", ""),
        detail=detail,
        before=before,
        after=after,
    )


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@api_bp.get("/health/details")
def health_details():
    db_ok = check_db(current_app.config["DB_URL"])
    ldap_ok = check_ldap(_ldap_client())
    return jsonify({"api": True, "db": db_ok, "ldap": ldap_ok})


@api_bp.post("/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "").strip()
    password = payload.get("password", "")
    role_hint = payload.get("roleHint", "")
    if not username or not password:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    locked_until = is_locked(current_app.config["DB_URL"], username)
    if locked_until:
        return (
            jsonify(
                {
                    "code": "RATE_LIMITED",
                    "message": "账号已锁定，请稍后再试",
                    "locked_until": locked_until.isoformat(),
                }
            ),
            429,
        )

    ldap_client = _ldap_client()
    if not ldap_client.authenticate_user(username, password):
        record_fail(
            current_app.config["DB_URL"],
            username,
            current_app.config.get("LOGIN_MAX_FAILS", 5),
            current_app.config.get("LOGIN_LOCK_MINUTES", 10),
        )
        return jsonify({"code": "AUTH_INVALID", "message": "账号或密码错误"}), 401
    clear_fail(current_app.config["DB_URL"], username)

    user_info = ldap_client.get_user_info(username) or {}
    is_admin = ldap_client.is_user_admin(username, current_app.config["ADMIN_GROUP_DN"])
    if role_hint == "admin" and not is_admin:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403

    if role_hint == "admin" and is_admin:
        otp_record = get_secret(current_app.config["DB_URL"], username)
        if not otp_record:
            otp_token = issue_token(
                current_app.config["APP_SECRET"],
                {"type": "otp", "username": username, "mode": "setup"},
            )
            return jsonify(
                {
                    "otp_required": True,
                    "otp_setup_required": True,
                    "otp_token": otp_token,
                }
            )

        if not otp_record.get("enabled", False):
            otp_token = issue_token(
                current_app.config["APP_SECRET"],
                {"type": "otp", "username": username, "mode": "setup"},
            )
            return jsonify(
                {
                    "otp_required": True,
                    "otp_setup_required": True,
                    "otp_token": otp_token,
                }
            )

        otp_token = issue_token(
            current_app.config["APP_SECRET"],
            {"type": "otp", "username": username, "mode": "verify"},
        )
        return jsonify({"otp_required": True, "otp_token": otp_token})

    session_token = issue_token(
        current_app.config["APP_SECRET"], {"type": "session", "username": username, "role": "user"}
    )
    return jsonify({"token": session_token, "user": user_info})


@api_bp.post("/auth/otp/verify")
def otp_verify():
    payload = request.get_json(silent=True) or {}
    otp_token = payload.get("otp_token", "")
    code = payload.get("code", "")
    if not otp_token or not code:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400

    data = verify_token(current_app.config["APP_SECRET"], otp_token, OTP_TOKEN_TTL)
    if not data or data.get("type") != "otp":
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401

    username = data.get("username", "")
    otp_record = get_secret(current_app.config["DB_URL"], username)
    if not otp_record:
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401

    if not verify_code(otp_record["secret"], code, current_app.config["OTP_WINDOW"]):
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401

    enable_secret(current_app.config["DB_URL"], username)
    session_token = issue_token(
        current_app.config["APP_SECRET"], {"type": "session", "username": username, "role": "admin"}
    )
    return jsonify({"token": session_token})


@api_bp.post("/auth/logout")
def logout():
    return jsonify({"status": "ok"})


@api_bp.post("/auth/otp/setup")
def otp_setup():
    payload = request.get_json(silent=True) or {}
    otp_token = payload.get("otp_token", "")
    if not otp_token:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400

    data = verify_token(current_app.config["APP_SECRET"], otp_token, OTP_TOKEN_TTL)
    if not data or data.get("type") != "otp" or data.get("mode") not in {"setup", "verify"}:
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401

    username = data.get("username", "")
    secret = create_secret(current_app.config["DB_URL"], username)
    issuer = current_app.config["OTP_ISSUER"]
    uri = f"otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}"
    return jsonify({"secret": secret, "otpauth_uri": uri})


@api_bp.get("/me")
def me():
    data = _require_session()
    if not data:
        return jsonify({"code": "AUTH_REQUIRED", "message": "未登录"}), 401

    username = data.get("username", "")
    ldap_client = _ldap_client()
    user_info = ldap_client.get_user_info(username)
    if not user_info:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    return jsonify(user_info)


@api_bp.post("/auth/sms/send")
def send_sms_code():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "").strip()
    scene = payload.get("scene", "").strip()
    current_app.logger.info("SMS_SEND_REQUEST user=%s scene=%s env=%s", username, scene, current_app.config["APP_ENV"])
    if not username or scene not in {"forgot", "change"}:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    if scene == "change":
        actor = _require_session()
        if not actor:
            return jsonify({"code": "AUTH_REQUIRED", "message": "未登录"}), 401
        if actor.get("username") != username:
            return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    actor_info = {"username": username, "role": "user"}
    ldap_client = _ldap_client()
    info = ldap_client.get_user_info(username)
    phone = (info or {}).get("mobile") or ""
    if not phone:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "手机号不存在"}), 404
    masked_phone = f"{phone[:3]}****{phone[-4:]}" if len(phone) >= 7 else "***"
    if not can_send(current_app.config["DB_URL"], username, scene, current_app.config["SMS_SEND_INTERVAL"]):
        return jsonify({"code": "RATE_LIMITED", "message": "发送过于频繁"}), 429
    code = create_code(
        current_app.config["DB_URL"],
        username,
        phone,
        scene,
        current_app.config["SMS_CODE_TTL"],
    )
    if current_app.config["APP_ENV"] != "development":
        template = current_app.config["ALIYUN_SMS_TEMPLATE_RESET"]
        if scene == "change":
            template = current_app.config["ALIYUN_SMS_TEMPLATE_RESET"]
        if not all(
            [
                current_app.config["ALIYUN_ACCESS_KEY_ID"],
                current_app.config["ALIYUN_ACCESS_KEY_SECRET"],
                current_app.config["ALIYUN_SMS_SIGN_NAME"],
                template,
            ]
        ):
            current_app.logger.error(
                "SMS_SEND_CONFIG_MISSING user=%s scene=%s phone=%s", username, scene, masked_phone
            )
            return jsonify({"code": "CONFIG_ERROR", "message": "短信配置不完整"}), 500
        try:
            current_app.logger.info(
                "SMS_SEND_ATTEMPT user=%s scene=%s phone=%s template=%s",
                username,
                scene,
                masked_phone,
                template,
            )
            send_via_aliyun(
                access_key_id=current_app.config["ALIYUN_ACCESS_KEY_ID"],
                access_key_secret=current_app.config["ALIYUN_ACCESS_KEY_SECRET"],
                sign_name=current_app.config["ALIYUN_SMS_SIGN_NAME"],
                template_code=template,
                phone=phone,
                template_param={"code": code},
            )
            mark_sent(current_app.config["DB_URL"], username, scene, code)
        except Exception as exc:
            current_app.logger.exception(
                "SMS_SEND_FAILED user=%s scene=%s phone=%s error=%s", username, scene, masked_phone, str(exc)
            )
            mark_failed(current_app.config["DB_URL"], username, scene, code, str(exc))
            _audit(actor_info, "SMS_SEND", username, "error", str(exc))
            return jsonify({"code": "SMS_ERROR", "message": "短信发送失败"}), 502
    else:
        current_app.logger.info(
            "SMS_SEND_SKIPPED_ENV user=%s scene=%s phone=%s", username, scene, masked_phone
        )
        mark_sent(current_app.config["DB_URL"], username, scene, code)
    _audit(actor_info, "SMS_SEND", username, "ok", scene)
    resp = {"status": "ok"}
    if current_app.config["APP_ENV"] == "development":
        resp["dev_code"] = code
    return jsonify(resp)


@api_bp.post("/sms/retry")
def retry_sms():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    items = retry_pending(current_app.config["DB_URL"], limit=10)
    if not items:
        return jsonify({"status": "ok", "retried": 0})
    errors = 0
    for item in items:
        try:
            send_via_aliyun(
                access_key_id=current_app.config["ALIYUN_ACCESS_KEY_ID"],
                access_key_secret=current_app.config["ALIYUN_ACCESS_KEY_SECRET"],
                sign_name=current_app.config["ALIYUN_SMS_SIGN_NAME"],
                template_code=current_app.config["ALIYUN_SMS_TEMPLATE_RESET"],
                phone=item["phone"],
                template_param={"code": item["code"]},
            )
            mark_sent(current_app.config["DB_URL"], item["username"], item["scene"], item["code"])
        except Exception as exc:
            errors += 1
            mark_failed(current_app.config["DB_URL"], item["username"], item["scene"], item["code"], str(exc))
    return jsonify({"status": "ok", "retried": len(items), "errors": errors})


@api_bp.get("/sms/list")
def list_sms_logs():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    username = request.args.get("username", "").strip()
    scene = request.args.get("scene", "").strip()
    status = request.args.get("status", "").strip()
    limit = int(request.args.get("limit", "100"))
    items = list_sms(
        current_app.config["DB_URL"],
        username=username,
        scene=scene,
        status=status,
        limit=limit,
    )
    return jsonify({"items": items})


@api_bp.post("/auth/forgot/reset")
def forgot_reset():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "").strip()
    code = payload.get("code", "").strip()
    new_password = payload.get("newPassword", "")
    if not username or not code or not new_password:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    if not verify_sms_code(current_app.config["DB_URL"], username, "forgot", code):
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401
    ldap_client = _ldap_client()
    user_dn = ldap_client.get_user_dn(username)
    if not user_dn:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    try:
        ldap_client.reset_password(user_dn, new_password)
    except ADConnectionError as exc:
        message = str(exc)
        code = "AD_ERROR"
        if "password" in message.lower():
            code = "AD_POLICY_VIOLATION"
        _audit({"username": username, "role": "user"}, "PASSWORD_RESET_FORGOT", username, "error", message)
        return jsonify({"code": code, "message": "密码策略不符合要求"}), 400
    _audit({"username": username, "role": "user"}, "PASSWORD_RESET_FORGOT", username, "ok")
    return jsonify({"status": "ok"})


@api_bp.post("/auth/email/send")
def send_email_code():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "").strip()
    scene = payload.get("scene", "").strip()
    if not username or scene not in {"forgot"}:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    info = ldap_client.get_user_info(username)
    email = (info or {}).get("mail") or ""
    if not email:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "邮箱不存在"}), 404
    code = create_email_code(
        current_app.config["DB_URL"],
        username,
        email,
        scene,
        current_app.config["SMS_CODE_TTL"],
    )
    if current_app.config["APP_ENV"] != "development":
        if not all(
            [
                current_app.config["SMTP_HOST"],
                current_app.config["SMTP_FROM"],
            ]
        ):
            return jsonify({"code": "CONFIG_ERROR", "message": "邮件配置不完整"}), 500
        try:
            send_email(
                smtp_host=current_app.config["SMTP_HOST"],
                smtp_port=current_app.config["SMTP_PORT"],
                smtp_user=current_app.config["SMTP_USER"],
                smtp_password=current_app.config["SMTP_PASSWORD"],
                smtp_from=current_app.config["SMTP_FROM"],
                to_email=email,
                subject="ADMTPRO 密码重置验证码",
                body=f"您的验证码是：{code}，有效期 {current_app.config['SMS_CODE_TTL']} 秒。",
            )
        except Exception as exc:
            _audit({"username": username, "role": "user"}, "EMAIL_SEND", username, "error", str(exc))
            return jsonify({"code": "EMAIL_ERROR", "message": "邮件发送失败"}), 502
    _audit({"username": username, "role": "user"}, "EMAIL_SEND", username, "ok")
    resp = {"status": "ok"}
    if current_app.config["APP_ENV"] == "development":
        resp["dev_code"] = code
    return jsonify(resp)


@api_bp.post("/auth/email/reset")
def email_reset():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "").strip()
    code = payload.get("code", "").strip()
    new_password = payload.get("newPassword", "")
    if not username or not code or not new_password:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    if not verify_email_code(current_app.config["DB_URL"], username, "forgot", code):
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401
    ldap_client = _ldap_client()
    user_dn = ldap_client.get_user_dn(username)
    if not user_dn:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    try:
        ldap_client.reset_password(user_dn, new_password)
    except ADConnectionError as exc:
        message = str(exc)
        code = "AD_ERROR"
        if "password" in message.lower():
            code = "AD_POLICY_VIOLATION"
        _audit({"username": username, "role": "user"}, "PASSWORD_RESET_FORGOT", username, "error", message)
        return jsonify({"code": code, "message": "密码策略不符合要求"}), 400
    _audit({"username": username, "role": "user"}, "PASSWORD_RESET_FORGOT", username, "ok")
    return jsonify({"status": "ok"})


@api_bp.post("/me/password")
def change_password():
    actor = _require_session()
    if not actor:
        return jsonify({"code": "AUTH_REQUIRED", "message": "未登录"}), 401
    payload = request.get_json(silent=True) or {}
    old_password = payload.get("oldPassword", "")
    new_password = payload.get("newPassword", "")
    code = payload.get("code", "")
    if not old_password or not new_password or not code:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    username = actor.get("username", "")
    if not verify_sms_code(current_app.config["DB_URL"], username, "change", code):
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401
    ldap_client = _ldap_client()
    try:
        ldap_client.change_password(username, old_password, new_password)
    except ADConnectionError as exc:
        message = str(exc)
        code = "AD_ERROR"
        if "password" in message.lower():
            code = "AD_POLICY_VIOLATION"
        _audit(actor, "PASSWORD_CHANGE_SELF", username, "error", message)
        return jsonify({"code": code, "message": "密码策略不符合要求"}), 400
    _audit(actor, "PASSWORD_CHANGE_SELF", username, "ok")
    return jsonify({"status": "ok"})


@api_bp.get("/users")
def list_users():
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    q = request.args.get("q", "").strip()
    ou = request.args.get("ou", "").strip()
    status = request.args.get("status", "").strip().lower()
    page = request.args.get("page", "1").strip()
    page_size = request.args.get("pageSize", "15").strip()
    try:
        page_i = max(int(page), 1)
    except ValueError:
        page_i = 1
    try:
        page_size_i = int(page_size)
    except ValueError:
        page_size_i = 15
    if page_size_i <= 0:
        page_size_i = 15
    if page_size_i > 200:
        page_size_i = 200
    enabled = None
    if status == "enabled":
        enabled = True
    elif status == "disabled":
        enabled = False
    ldap_client = _ldap_client()
    users = ldap_client.search_users(query=q, ou_dn=ou, enabled=enabled)
    total = len(users)
    start = (page_i - 1) * page_size_i
    end = start + page_size_i
    items = users[start:end]
    return jsonify({"items": items, "total": total, "page": page_i, "pageSize": page_size_i})


@api_bp.post("/users")
def create_user():
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    required = ["sAMAccountName", "displayName", "ouDn", "password"]
    if any(not payload.get(k) for k in required):
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    attrs = {}
    for key in ["mail", "mobile", "department", "title"]:
        if payload.get(key):
            attrs[key] = payload[key]
    force_change = bool(payload.get("forceChangeAtFirstLogin", False))
    ldap_client = _ldap_client()
    try:
        ldap_client.create_user(
            sAMAccountName=payload["sAMAccountName"],
            displayName=payload["displayName"],
            ou_dn=payload["ouDn"],
            password=payload["password"],
            attributes=attrs,
            force_change=force_change,
        )
    except ADConnectionError as exc:
        message = str(exc)
        code = "AD_ERROR"
        if "password" in message.lower():
            code = "AD_POLICY_VIOLATION"
        _audit(actor, "USER_CREATE", payload.get("sAMAccountName", ""), "error", message)
        return jsonify({"code": code, "message": "密码策略不符合要求"}), 400
    _audit(
        actor,
        "USER_CREATE",
        payload.get("sAMAccountName", ""),
        "ok",
        after={"ou": payload.get("ouDn", ""), "attrs": attrs},
    )
    return jsonify({"status": "ok"})


@api_bp.put("/users/<username>")
def update_user(username: str):
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    changes = {}
    for key in ["mail", "mobile", "department", "title", "displayName"]:
        if key in payload:
            changes[key] = payload[key]
    if not changes:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    user_dn = ldap_client.get_user_dn(username)
    if not user_dn:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    before = ldap_client.get_user_info(username) or {}
    try:
        ldap_client.update_user(user_dn, changes)
    except ADConnectionError as exc:
        _audit(actor, "USER_UPDATE", username, "error", str(exc))
        return jsonify({"code": "AD_ERROR", "message": str(exc)}), 500
    after = ldap_client.get_user_info(username) or {}
    _audit(actor, "USER_UPDATE", username, "ok", before=before, after=after)
    return jsonify({"status": "ok"})


@api_bp.patch("/users/<username>/status")
def set_user_status(username: str):
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    if "enabled" not in payload:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    user_dn = ldap_client.get_user_dn(username)
    if not user_dn:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    try:
        ldap_client.set_user_enabled(user_dn, bool(payload["enabled"]))
    except ADConnectionError as exc:
        _audit(actor, "USER_STATUS", username, "error", str(exc))
        return jsonify({"code": "AD_ERROR", "message": str(exc)}), 500
    _audit(
        actor,
        "USER_STATUS",
        username,
        "ok",
        before={"enabled": not bool(payload["enabled"])},
        after={"enabled": bool(payload["enabled"])},
    )
    return jsonify({"status": "ok"})


@api_bp.post("/users/<username>/reset-password")
def reset_password(username: str):
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    new_password = payload.get("newPassword", "")
    force_change = bool(payload.get("forceChangeAtFirstLogin", False))
    if not new_password:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    user_dn = ldap_client.get_user_dn(username)
    if not user_dn:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    try:
        ldap_client.reset_password(user_dn, new_password, force_change=force_change)
    except ADConnectionError as exc:
        message = str(exc)
        code = "AD_ERROR"
        if "password" in message.lower():
            code = "AD_POLICY_VIOLATION"
        _audit(actor, "PASSWORD_RESET_ADMIN", username, "error", message)
        return jsonify({"code": code, "message": "密码策略不符合要求"}), 400
    _audit(actor, "PASSWORD_RESET_ADMIN", username, "ok")
    return jsonify({"status": "ok"})


@api_bp.get("/users/export")
def export_users():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    q = request.args.get("q", "").strip()
    ou = request.args.get("ou", "").strip()
    status = request.args.get("status", "").strip().lower()
    enabled = None
    if status == "enabled":
        enabled = True
    elif status == "disabled":
        enabled = False
    ldap_client = _ldap_client()
    users = ldap_client.search_users(query=q, ou_dn=ou, enabled=enabled)
    header = ["sAMAccountName", "displayName", "mail", "mobile", "department", "title", "dn"]
    rows = [header]
    for u in users:
        rows.append([u.get(k, "") or "" for k in header])
    csv_text = "\n".join([",".join(row) for row in rows])
    resp = current_app.response_class(csv_text, mimetype="text/csv")
    resp.headers["Content-Disposition"] = "attachment; filename=users.csv"
    return resp


@api_bp.post("/users/import")
def import_users():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    csv_text = payload.get("csv", "")
    if not csv_text:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    import csv
    import io

    ldap_client = _ldap_client()
    reader = csv.DictReader(io.StringIO(csv_text))
    created = 0
    errors = 0
    for row in reader:
        try:
            ldap_client.create_user(
                sAMAccountName=row.get("sAMAccountName", ""),
                displayName=row.get("displayName", ""),
                ou_dn=row.get("ouDn", ""),
                password=row.get("password", ""),
                attributes={
                    "mail": row.get("mail", ""),
                    "mobile": row.get("mobile", ""),
                    "department": row.get("department", ""),
                    "title": row.get("title", ""),
                },
                force_change=str(row.get("forceChangeAtFirstLogin", "")).lower() in {"1", "true", "yes"},
            )
            created += 1
        except Exception:
            errors += 1
    return jsonify({"created": created, "errors": errors})


@api_bp.post("/users/batch")
def batch_users():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    action = payload.get("action", "")
    usernames = payload.get("usernames", [])
    if not action or not isinstance(usernames, list) or not usernames:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    count = 0
    for username in usernames:
        user_dn = ldap_client.get_user_dn(username)
        if not user_dn:
            continue
        try:
            if action == "enable":
                ldap_client.set_user_enabled(user_dn, True)
            elif action == "disable":
                ldap_client.set_user_enabled(user_dn, False)
            elif action == "move":
                target_ou = payload.get("targetOuDn", "")
                if not target_ou:
                    return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
                ldap_client.move_user(user_dn, target_ou)
            else:
                return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
            count += 1
        except Exception:
            continue
    return jsonify({"count": count})


@api_bp.delete("/users/<username>")
def delete_user(username: str):
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    ldap_client = _ldap_client()
    user_dn = ldap_client.get_user_dn(username)
    if not user_dn:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    before = ldap_client.get_user_info(username) or {}
    try:
        ldap_client.delete_user(user_dn)
    except ADConnectionError as exc:
        _audit(actor, "USER_DELETE", username, "error", str(exc))
        return jsonify({"code": "AD_ERROR", "message": str(exc)}), 500
    _audit(actor, "USER_DELETE", username, "ok", before=before)
    return jsonify({"status": "ok"})


@api_bp.post("/users/<username>/move")
def move_user(username: str):
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    target_ou = payload.get("targetOuDn", "")
    if not target_ou:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    user_dn = ldap_client.get_user_dn(username)
    if not user_dn:
        return jsonify({"code": "OBJECT_NOT_FOUND", "message": "用户不存在"}), 404
    try:
        ldap_client.move_user(user_dn, target_ou)
    except ADConnectionError as exc:
        _audit(actor, "USER_MOVE_OU", username, "error", str(exc))
        return jsonify({"code": "AD_ERROR", "message": str(exc)}), 500
    _audit(
        actor,
        "USER_MOVE_OU",
        username,
        "ok",
        before={"dn": user_dn},
        after={"ou": target_ou},
    )
    return jsonify({"status": "ok"})


@api_bp.get("/ous")
def list_ous():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    ldap_client = _ldap_client()
    ous = ldap_client.list_ous()
    return jsonify({"items": ous})


@api_bp.post("/ous")
def create_ou():
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "")
    parent_dn = payload.get("parentDn", "")
    description = payload.get("description", "")
    if not name or not parent_dn:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    try:
        ldap_client.create_ou(name, parent_dn, description)
    except ADConnectionError as exc:
        _audit(actor, "OU_CREATE", name, "error", str(exc))
        return jsonify({"code": "AD_ERROR", "message": str(exc)}), 500
    _audit(actor, "OU_CREATE", name, "ok", parent_dn)
    return jsonify({"status": "ok"})


@api_bp.put("/ous")
def update_ou():
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    ou_dn = payload.get("dn", "")
    name = payload.get("name")
    description = payload.get("description")
    if not ou_dn:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    try:
        ldap_client.update_ou(ou_dn, name, description)
    except ADConnectionError as exc:
        _audit(actor, "OU_UPDATE", ou_dn, "error", str(exc))
        return jsonify({"code": "AD_ERROR", "message": str(exc)}), 500
    _audit(actor, "OU_UPDATE", ou_dn, "ok")
    return jsonify({"status": "ok"})


@api_bp.delete("/ous")
def delete_ou():
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    ou_dn = payload.get("dn", "")
    if not ou_dn:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    ldap_client = _ldap_client()
    try:
        ldap_client.delete_ou(ou_dn)
    except ADConnectionError as exc:
        _audit(actor, "OU_DELETE", ou_dn, "error", str(exc))
        message = str(exc)
        if "CANT_ON_NON_LEAF" in message:
            return jsonify({"code": "AD_NON_LEAF", "message": "该 OU 下还有子对象，无法删除"}), 400
        return jsonify({"code": "AD_ERROR", "message": message}), 500
    _audit(actor, "OU_DELETE", ou_dn, "ok")
    return jsonify({"status": "ok"})


@api_bp.get("/audit")
def audit_logs():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    actor = request.args.get("actor", "").strip()
    action = request.args.get("action", "").strip()
    target = request.args.get("target", "").strip()
    result = request.args.get("result", "").strip()
    limit = int(request.args.get("limit", "100"))
    items = list_logs(
        current_app.config["DB_URL"], actor=actor, action=action, target=target, result=result, limit=limit
    )
    return jsonify({"items": items})


@api_bp.get("/audit/export")
def audit_export():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    actor = request.args.get("actor", "").strip()
    action = request.args.get("action", "").strip()
    target = request.args.get("target", "").strip()
    result = request.args.get("result", "").strip()
    limit = int(request.args.get("limit", "1000"))
    csv_text = export_csv(
        current_app.config["DB_URL"], actor=actor, action=action, target=target, result=result, limit=limit
    )
    resp = current_app.response_class(csv_text, mimetype="text/csv")
    resp.headers["Content-Disposition"] = "attachment; filename=audit.csv"
    return resp


@api_bp.get("/notifications")
def notifications():
    actor = _require_session()
    if not actor:
        return jsonify({"code": "AUTH_REQUIRED", "message": "未登录"}), 401
    items = list_expiry_notifies(current_app.config["DB_URL"], username=actor.get("username", ""), limit=50)
    return jsonify({"items": items})


@api_bp.get("/password-expiry/list")
def password_expiry_list():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    username = request.args.get("username", "").strip()
    status = request.args.get("status", "").strip()
    limit = int(request.args.get("limit", "100"))
    items = list_expiry_notifies(
        current_app.config["DB_URL"], username=username, status=status, limit=limit
    )
    return jsonify({"items": items})


@api_bp.post("/password-expiry/trigger")
def password_expiry_trigger():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    ldap_client = _ldap_client()
    trigger_password_expiry_check(
        ldap_client=ldap_client,
        db_url=current_app.config["DB_URL"],
        days_value=current_app.config["PASSWORD_EXPIRY_DAYS"],
        aliyun_access_key_id=current_app.config["ALIYUN_ACCESS_KEY_ID"],
        aliyun_access_key_secret=current_app.config["ALIYUN_ACCESS_KEY_SECRET"],
        aliyun_sign_name=current_app.config["ALIYUN_SMS_SIGN_NAME"],
        aliyun_template_code=current_app.config["ALIYUN_SMS_TEMPLATE_NOTIFY"],
    )
    return jsonify({"status": "ok"})


@api_bp.get("/config")
def config_get():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    overrides = get_config(current_app.config["DB_URL"])
    data = {
        "LDAP_URL": current_app.config["LDAP_URL"],
        "LDAP_BASE_DN": current_app.config["LDAP_BASE_DN"],
        "ADMIN_GROUP_DN": current_app.config["ADMIN_GROUP_DN"],
        "OTP_ISSUER": current_app.config["OTP_ISSUER"],
        "SMS_SEND_INTERVAL": current_app.config["SMS_SEND_INTERVAL"],
        "SMS_CODE_TTL": current_app.config["SMS_CODE_TTL"],
        "PASSWORD_EXPIRY_ENABLE": current_app.config["PASSWORD_EXPIRY_ENABLE"],
        "PASSWORD_EXPIRY_DAYS": current_app.config["PASSWORD_EXPIRY_DAYS"],
        "PASSWORD_EXPIRY_CHECK_INTERVAL": current_app.config["PASSWORD_EXPIRY_CHECK_INTERVAL"],
    }
    data.update(overrides)
    return jsonify(data)


@api_bp.put("/config")
def config_set():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    for key, value in payload.items():
        set_config(current_app.config["DB_URL"], key, value)
    apply_overrides(current_app.config, payload)
    if current_app.config.get("SMS_AUTO_RETRY") and not current_app.config.get("SMS_RETRY_LOOP_STARTED"):
        start_sms_retry_loop(
            db_url=current_app.config["DB_URL"],
            interval_seconds=current_app.config["SMS_RETRY_INTERVAL"],
            access_key_id=current_app.config["ALIYUN_ACCESS_KEY_ID"],
            access_key_secret=current_app.config["ALIYUN_ACCESS_KEY_SECRET"],
            sign_name=current_app.config["ALIYUN_SMS_SIGN_NAME"],
            template_code=current_app.config["ALIYUN_SMS_TEMPLATE_RESET"],
        )
        current_app.config["SMS_RETRY_LOOP_STARTED"] = True
    if current_app.config.get("PASSWORD_EXPIRY_ENABLE") and not current_app.config.get("EXPIRY_LOOP_STARTED"):
        start_password_expiry_loop(
            ldap_client_factory=lambda: _ldap_client(),
            db_url=current_app.config["DB_URL"],
            days_value=current_app.config["PASSWORD_EXPIRY_DAYS"],
            interval_seconds=current_app.config["PASSWORD_EXPIRY_CHECK_INTERVAL"],
            aliyun_access_key_id=current_app.config["ALIYUN_ACCESS_KEY_ID"],
            aliyun_access_key_secret=current_app.config["ALIYUN_ACCESS_KEY_SECRET"],
            aliyun_sign_name=current_app.config["ALIYUN_SMS_SIGN_NAME"],
            aliyun_template_code=current_app.config["ALIYUN_SMS_TEMPLATE_NOTIFY"],
        )
        current_app.config["EXPIRY_LOOP_STARTED"] = True
    return jsonify({"status": "ok"})


@api_bp.get("/config/history")
def config_history():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    limit = int(request.args.get("limit", "100"))
    items = list_history(current_app.config["DB_URL"], limit=limit)
    return jsonify({"items": items})


@api_bp.post("/config/rollback")
def config_rollback():
    if not _require_session("admin"):
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    payload = request.get_json(silent=True) or {}
    history_id = int(payload.get("id", 0))
    if history_id <= 0:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    rollback(current_app.config["DB_URL"], history_id)
    return jsonify({"status": "ok"})
