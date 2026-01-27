import threading
import time
from datetime import datetime, timezone
from typing import Iterable

from ..adapters.ldap_client import LDAPClient
from ..core.db import get_conn
from ..services.sms_service import send_via_aliyun
from ..services.audit_service import write_log


def _today_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_days_list(value: str) -> list[int]:
    days = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            days.append(int(part))
        except ValueError:
            continue
    return sorted(set(days))


def _should_notify(db_url: str, username: str, days_left: int, notify_date: str) -> bool:
    with get_conn(db_url) as conn:
        row = conn.execute(
            """
            SELECT 1 FROM password_expiry_notifies
            WHERE username = %s AND days_left = %s AND notify_date = %s
            """,
            (username, days_left, notify_date),
        ).fetchone()
        return row is None


def _record_notify(db_url: str, username: str, days_left: int, notify_date: str, status: str, error: str = "") -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO password_expiry_notifies (username, days_left, notify_date, status, last_error)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (username, days_left, notify_date, status, error or None),
        )


def run_password_expiry_check(
    *,
    ldap_client: LDAPClient,
    db_url: str,
    days_list: Iterable[int],
    aliyun_access_key_id: str,
    aliyun_access_key_secret: str,
    aliyun_sign_name: str,
    aliyun_template_code: str,
) -> None:
    if not days_list:
        return
    now = _today_utc()
    notify_date = now.date().isoformat()
    expiring = ldap_client.list_users_password_expiring(max(days_list))
    for item in expiring:
        username = item.get("sAMAccountName") or ""
        days_left = item.get("days_left")
        phone = item.get("mobile") or ""
        if not username or days_left is None or days_left not in days_list:
            continue
        if not phone:
            continue
        if not _should_notify(db_url, username, days_left, notify_date):
            continue
        try:
            send_via_aliyun(
                access_key_id=aliyun_access_key_id,
                access_key_secret=aliyun_access_key_secret,
                sign_name=aliyun_sign_name,
                template_code=aliyun_template_code,
                phone=phone,
                template_param={"days": days_left},
            )
            _record_notify(db_url, username, days_left, notify_date, "sent")
            write_log(
                db_url,
                actor="system",
                actor_role="system",
                action="PASSWORD_EXPIRY_NOTIFY",
                target=username,
                result="ok",
                ip="",
                ua="",
                detail=f"days_left={days_left}",
            )
        except Exception as exc:
            _record_notify(db_url, username, days_left, notify_date, "failed", str(exc))
            write_log(
                db_url,
                actor="system",
                actor_role="system",
                action="PASSWORD_EXPIRY_NOTIFY",
                target=username,
                result="error",
                ip="",
                ua="",
                detail=str(exc),
            )


def trigger_password_expiry_check(
    *,
    ldap_client: LDAPClient,
    db_url: str,
    days_value: str,
    aliyun_access_key_id: str,
    aliyun_access_key_secret: str,
    aliyun_sign_name: str,
    aliyun_template_code: str,
) -> None:
    days_list = _parse_days_list(days_value)
    if not days_list:
        return
    if not all([db_url, aliyun_access_key_id, aliyun_access_key_secret, aliyun_sign_name, aliyun_template_code]):
        return
    run_password_expiry_check(
        ldap_client=ldap_client,
        db_url=db_url,
        days_list=days_list,
        aliyun_access_key_id=aliyun_access_key_id,
        aliyun_access_key_secret=aliyun_access_key_secret,
        aliyun_sign_name=aliyun_sign_name,
        aliyun_template_code=aliyun_template_code,
    )


def start_password_expiry_loop(
    *,
    ldap_client_factory,
    db_url: str,
    days_value: str,
    interval_seconds: int,
    aliyun_access_key_id: str,
    aliyun_access_key_secret: str,
    aliyun_sign_name: str,
    aliyun_template_code: str,
) -> None:
    days_list = _parse_days_list(days_value)
    if not days_list:
        return
    if not all([db_url, aliyun_access_key_id, aliyun_access_key_secret, aliyun_sign_name, aliyun_template_code]):
        return

    def _loop() -> None:
        while True:
            try:
                ldap_client = ldap_client_factory()
                run_password_expiry_check(
                    ldap_client=ldap_client,
                    db_url=db_url,
                    days_list=days_list,
                    aliyun_access_key_id=aliyun_access_key_id,
                    aliyun_access_key_secret=aliyun_access_key_secret,
                    aliyun_sign_name=aliyun_sign_name,
                    aliyun_template_code=aliyun_template_code,
                )
            except Exception:
                pass
            time.sleep(interval_seconds)

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
