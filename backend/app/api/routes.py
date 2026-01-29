from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

from ..adapters.ldap_client import LDAPClient
from ..core.auth import issue_token, verify_token
from ..services.otp_service import (
    create_secret,
    enable_secret,
    get_secret,
    verify_code,
    has_valid_action_otp,
    record_action_otp,
)
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


def _require_admin_action_otp(actor: dict) -> bool:
    ttl_minutes = current_app.config.get("OTP_ACTION_TTL_MINUTES", 10)
    if ttl_minutes <= 0:
        return True
    return has_valid_action_otp(current_app.config["DB_URL"], actor.get("username", ""))


def _date_to_filetime(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    base = datetime(1601, 1, 1, tzinfo=timezone.utc)
    return int((dt - base).total_seconds() * 10_000_000)


def _ldap_client() -> LDAPClient:
    return LDAPClient(
        url=current_app.config["LDAP_URL"],
        bind_dn=current_app.config["LDAP_BIND_DN"],
        bind_password=current_app.config["LDAP_BIND_PASSWORD"],
        base_dn=current_app.config["LDAP_BASE_DN"],
        ca_cert=current_app.config["LDAP_CA_CERT"],
        tls_verify=current_app.config.get("LDAP_TLS_VERIFY", True),
        tls_allow_weak=current_app.config.get("LDAP_TLS_ALLOW_WEAK", False),
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


@api_bp.post("/auth/otp/verify-action")
def otp_verify_action():
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "AUTH_REQUIRED", "message": "未登录"}), 401
    payload = request.get_json(silent=True) or {}
    code = payload.get("code", "")
    if not code:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    username = actor.get("username", "")
    otp_record = get_secret(current_app.config["DB_URL"], username)
    if not otp_record:
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401
    if not verify_code(otp_record["secret"], code, current_app.config["OTP_WINDOW"]):
        return jsonify({"code": "AUTH_INVALID", "message": "验证码无效或已过期"}), 401
    record_action_otp(current_app.config["DB_URL"], username, current_app.config["OTP_ACTION_TTL_MINUTES"])
    return jsonify({"status": "ok"})


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
        if current_app.config["SMTP_SSL"] and current_app.config["SMTP_TLS"]:
            current_app.logger.warning("SMTP_SSL and SMTP_TLS both enabled; SSL will take precedence.")
        try:
            subject_template = current_app.config.get("EMAIL_RESET_SUBJECT", "ADMTPRO 密码重置验证码")
            body_template = current_app.config.get("EMAIL_RESET_TEMPLATE", "您的验证码是：{code}，有效期 {ttl} 秒。")
            try:
                subject = subject_template.format(username=username, code=code, ttl=current_app.config["SMS_CODE_TTL"])
            except Exception:
                subject = subject_template
            try:
                body = body_template.format(username=username, code=code, ttl=current_app.config["SMS_CODE_TTL"])
            except Exception:
                body = f"您的验证码是：{code}，有效期 {current_app.config['SMS_CODE_TTL']} 秒。"
            send_email(
                smtp_host=current_app.config["SMTP_HOST"],
                smtp_port=current_app.config["SMTP_PORT"],
                smtp_user=current_app.config["SMTP_USER"],
                smtp_password=current_app.config["SMTP_PASSWORD"],
                smtp_from=current_app.config["SMTP_FROM"],
                smtp_ssl=current_app.config["SMTP_SSL"],
                smtp_tls=current_app.config["SMTP_TLS"],
                to_email=email,
                subject=subject,
                body=body,
            )
        except Exception as exc:
            current_app.logger.exception(
                "email send failed: user=%s email=%s smtp=%s:%s ssl=%s tls=%s",
                username,
                email,
                current_app.config["SMTP_HOST"],
                current_app.config["SMTP_PORT"],
                current_app.config["SMTP_SSL"],
                current_app.config["SMTP_TLS"],
            )
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
    elif not q:
        enabled = True
    ldap_client = _ldap_client()
    users = ldap_client.search_users(query=q, ou_dn=ou, enabled=enabled)
    if not q:
        users = [u for u in users if (u.get("mobile") or "").strip()]
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
    payload = request.get_json(silent=True) or {}
    changes = {}
    for key in ["mail", "mobile", "department", "title", "displayName"]:
        if key in payload:
            changes[key] = payload[key]
    if "accountExpiryDate" in payload:
        account_expiry = payload.get("accountExpiryDate") or ""
        if account_expiry:
            try:
                changes["accountExpires"] = _date_to_filetime(account_expiry)
            except ValueError:
                return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
        else:
            changes["accountExpires"] = 0
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
        "APP_NAME": current_app.config.get("APP_NAME", "ADMTPRO"),
        "APP_LOGO_URL": current_app.config.get("APP_LOGO_URL", ""),
        "APP_FAVICON_URL": current_app.config.get("APP_FAVICON_URL", ""),
        "APP_LOGIN_BANNER": current_app.config.get("APP_LOGIN_BANNER", ""),
        "APP_PRIMARY_COLOR": current_app.config.get("APP_PRIMARY_COLOR", "#4F46E5"),
        "APP_SECONDARY_COLOR": current_app.config.get("APP_SECONDARY_COLOR", "#F59E0B"),
        "APP_PAGE_BG_COLOR": current_app.config.get("APP_PAGE_BG_COLOR", "#EEF2FF"),
        "APP_ALERT_BG_COLOR": current_app.config.get("APP_ALERT_BG_COLOR", "#FEF3C7"),
        "APP_SUPPORT_EMAIL": current_app.config.get("APP_SUPPORT_EMAIL", ""),
        "APP_SUPPORT_PHONE": current_app.config.get("APP_SUPPORT_PHONE", ""),
        "APP_FOOTER_TEXT": current_app.config.get("APP_FOOTER_TEXT", ""),
        "APP_COPYRIGHT": current_app.config.get("APP_COPYRIGHT", ""),
        "APP_FOOTER_ENABLED": current_app.config.get("APP_FOOTER_ENABLED", True),
        "LDAP_URL": current_app.config["LDAP_URL"],
        "LDAP_BASE_DN": current_app.config["LDAP_BASE_DN"],
        "ADMIN_GROUP_DN": current_app.config["ADMIN_GROUP_DN"],
        "OTP_ISSUER": current_app.config["OTP_ISSUER"],
        "OTP_ACTION_TTL_MINUTES": current_app.config.get("OTP_ACTION_TTL_MINUTES", 10),
        "SMS_SEND_INTERVAL": current_app.config["SMS_SEND_INTERVAL"],
        "SMS_CODE_TTL": current_app.config["SMS_CODE_TTL"],
        "PASSWORD_EXPIRY_ENABLE": current_app.config["PASSWORD_EXPIRY_ENABLE"],
        "PASSWORD_EXPIRY_DAYS": current_app.config["PASSWORD_EXPIRY_DAYS"],
        "PASSWORD_EXPIRY_CHECK_INTERVAL": current_app.config["PASSWORD_EXPIRY_CHECK_INTERVAL"],
        "SMTP_HOST": current_app.config.get("SMTP_HOST", ""),
        "SMTP_PORT": current_app.config.get("SMTP_PORT", 587),
        "SMTP_USER": current_app.config.get("SMTP_USER", ""),
        "SMTP_PASSWORD": current_app.config.get("SMTP_PASSWORD", ""),
        "SMTP_FROM": current_app.config.get("SMTP_FROM", ""),
        "SMTP_SSL": current_app.config.get("SMTP_SSL", False),
        "SMTP_TLS": current_app.config.get("SMTP_TLS", True),
        "EMAIL_RESET_SUBJECT": current_app.config.get("EMAIL_RESET_SUBJECT", "ADMTPRO 密码重置验证码"),
        "EMAIL_RESET_TEMPLATE": current_app.config.get("EMAIL_RESET_TEMPLATE", "您的验证码是：{code}，有效期 {ttl} 秒。"),
    }
    data.update(overrides)
    descriptions = {
        "APP_NAME": "系统名称",
        "APP_LOGO_URL": "Logo 图片 URL",
        "APP_FAVICON_URL": "浏览器图标 URL",
        "APP_LOGIN_BANNER": "登录页横幅/背景图 URL",
        "APP_PRIMARY_COLOR": "主色（HEX）",
        "APP_SECONDARY_COLOR": "次色（HEX）",
        "APP_PAGE_BG_COLOR": "页面背景色（HEX）",
        "APP_ALERT_BG_COLOR": "提示框背景色（HEX）",
        "APP_SUPPORT_EMAIL": "支持邮箱",
        "APP_SUPPORT_PHONE": "支持电话",
        "APP_FOOTER_TEXT": "页脚文案",
        "APP_COPYRIGHT": "版权信息",
        "APP_FOOTER_ENABLED": "是否显示页脚",
        "LDAP_URL": "LDAP/AD 连接地址",
        "LDAP_BASE_DN": "LDAP Base DN",
        "ADMIN_GROUP_DN": "管理员组 DN",
        "OTP_ISSUER": "OTP 发行者名称",
        "OTP_ACTION_TTL_MINUTES": "管理员高危操作OTP有效期(分钟)",
        "SMS_SEND_INTERVAL": "短信发送间隔(秒)",
        "SMS_CODE_TTL": "短信验证码有效期(秒)",
        "PASSWORD_EXPIRY_ENABLE": "是否启用密码到期提醒",
        "PASSWORD_EXPIRY_DAYS": "密码到期提醒天数(逗号分隔)",
        "PASSWORD_EXPIRY_CHECK_INTERVAL": "密码到期检查间隔(秒)",
        "SMTP_HOST": "SMTP 服务器地址",
        "SMTP_PORT": "SMTP 端口",
        "SMTP_USER": "SMTP 用户名",
        "SMTP_PASSWORD": "SMTP 密码",
        "SMTP_FROM": "邮件发件人",
        "SMTP_SSL": "SMTP 使用 SSL",
        "SMTP_TLS": "SMTP 使用 STARTTLS",
        "EMAIL_RESET_SUBJECT": "邮件重置主题（支持 {username}/{code}/{ttl}）",
        "EMAIL_RESET_TEMPLATE": "邮件正文模板（支持 {username}/{code}/{ttl}）",
    }
    return jsonify({"items": data, "descriptions": descriptions})


@api_bp.get("/public/config")
def public_config_get():
    data = {
        "APP_NAME": current_app.config.get("APP_NAME", "ADMTPRO"),
        "APP_LOGO_URL": current_app.config.get("APP_LOGO_URL", ""),
        "APP_FAVICON_URL": current_app.config.get("APP_FAVICON_URL", ""),
        "APP_LOGIN_BANNER": current_app.config.get("APP_LOGIN_BANNER", ""),
        "APP_PRIMARY_COLOR": current_app.config.get("APP_PRIMARY_COLOR", "#4F46E5"),
        "APP_SECONDARY_COLOR": current_app.config.get("APP_SECONDARY_COLOR", "#F59E0B"),
        "APP_PAGE_BG_COLOR": current_app.config.get("APP_PAGE_BG_COLOR", "#EEF2FF"),
        "APP_ALERT_BG_COLOR": current_app.config.get("APP_ALERT_BG_COLOR", "#FEF3C7"),
        "APP_SUPPORT_EMAIL": current_app.config.get("APP_SUPPORT_EMAIL", ""),
        "APP_SUPPORT_PHONE": current_app.config.get("APP_SUPPORT_PHONE", ""),
        "APP_FOOTER_TEXT": current_app.config.get("APP_FOOTER_TEXT", ""),
        "APP_COPYRIGHT": current_app.config.get("APP_COPYRIGHT", ""),
        "APP_FOOTER_ENABLED": current_app.config.get("APP_FOOTER_ENABLED", True),
    }
    overrides = get_config(current_app.config["DB_URL"])
    for key in list(data.keys()):
        if key in overrides:
            data[key] = overrides[key]
    return jsonify({"items": data})


@api_bp.put("/config")
def config_set():
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
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
    actor = _require_session("admin")
    if not actor:
        return jsonify({"code": "PERMISSION_DENIED", "message": "无权限执行该操作"}), 403
    if not _require_admin_action_otp(actor):
        return jsonify({"code": "OTP_REQUIRED", "message": "需要OTP验证"}), 403
    payload = request.get_json(silent=True) or {}
    history_id = int(payload.get("id", 0))
    if history_id <= 0:
        return jsonify({"code": "VALIDATION_ERROR", "message": "参数校验失败"}), 400
    rollback(current_app.config["DB_URL"], history_id)
    return jsonify({"status": "ok"})
