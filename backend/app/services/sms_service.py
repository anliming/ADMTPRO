import random
from datetime import datetime, timedelta, timezone

from ..core.db import get_conn
from ..adapters.aliyun_sms import send_sms


def _now() -> datetime:
    return datetime.now(timezone.utc)


def can_send(db_url: str, username: str, scene: str, min_interval_seconds: int) -> bool:
    with get_conn(db_url) as conn:
        row = conn.execute(
            """
            SELECT sent_at FROM sms_codes
            WHERE username = %s AND scene = %s
            ORDER BY sent_at DESC
            LIMIT 1
            """,
            (username, scene),
        ).fetchone()
        if not row:
            return True
        last_sent = row[0]
        return (last_sent + timedelta(seconds=min_interval_seconds)) <= _now()


def create_code(db_url: str, username: str, phone: str, scene: str, ttl_seconds: int) -> str:
    code = f"{random.randint(0, 999999):06d}"
    expires_at = _now() + timedelta(seconds=ttl_seconds)
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO sms_codes (username, phone, scene, code, expires_at, send_status)
            VALUES (%s, %s, %s, %s, %s, 'pending')
            """,
            (username, phone, scene, code, expires_at),
        )
    return code


def verify_code(db_url: str, username: str, scene: str, code: str) -> bool:
    with get_conn(db_url) as conn:
        row = conn.execute(
            """
            SELECT id, expires_at, used_at FROM sms_codes
            WHERE username = %s AND scene = %s AND code = %s
            ORDER BY sent_at DESC
            LIMIT 1
            """,
            (username, scene, code),
        ).fetchone()
        if not row:
            return False
        code_id, expires_at, used_at = row
        if used_at is not None:
            return False
        if expires_at < _now():
            return False
        conn.execute("UPDATE sms_codes SET used_at = NOW() WHERE id = %s", (code_id,))
        return True


def mark_sent(db_url: str, username: str, scene: str, code: str) -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            """
            UPDATE sms_codes
            SET send_status = 'sent', send_attempts = send_attempts + 1, last_error = NULL
            WHERE username = %s AND scene = %s AND code = %s
            """,
            (username, scene, code),
        )


def mark_failed(db_url: str, username: str, scene: str, code: str, error: str) -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            """
            UPDATE sms_codes
            SET send_status = 'failed', send_attempts = send_attempts + 1, last_error = %s
            WHERE username = %s AND scene = %s AND code = %s
            """,
            (error, username, scene, code),
        )


def retry_pending(db_url: str, limit: int = 10) -> list[dict]:
    with get_conn(db_url) as conn:
        rows = conn.execute(
            """
            SELECT username, phone, scene, code
            FROM sms_codes
            WHERE send_status = 'failed' AND send_attempts < 3
            ORDER BY sent_at DESC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
    return [
        {"username": r[0], "phone": r[1], "scene": r[2], "code": r[3]} for r in rows
    ]


def list_sms(
    db_url: str,
    *,
    username: str = "",
    scene: str = "",
    status: str = "",
    limit: int = 100,
) -> list[dict]:
    where = []
    params = []
    if username:
        where.append("username ILIKE %s")
        params.append(f"%{username}%")
    if scene:
        where.append("scene = %s")
        params.append(scene)
    if status:
        where.append("send_status = %s")
        params.append(status)
    clause = "WHERE " + " AND ".join(where) if where else ""
    sql = (
        "SELECT id, username, phone, scene, code, send_status, send_attempts, last_error, sent_at, expires_at, used_at "
        "FROM sms_codes "
        f"{clause} "
        "ORDER BY sent_at DESC "
        "LIMIT %s"
    )
    params.append(limit)
    with get_conn(db_url) as conn:
        rows = conn.execute(sql, params).fetchall()
    items = []
    for row in rows:
        items.append(
            {
                "id": row[0],
                "username": row[1],
                "phone": row[2],
                "scene": row[3],
                "code": row[4],
                "send_status": row[5],
                "send_attempts": row[6],
                "last_error": row[7],
                "sent_at": row[8].isoformat(),
                "expires_at": row[9].isoformat(),
                "used_at": row[10].isoformat() if row[10] else None,
            }
        )
    return items


def send_via_aliyun(
    *,
    access_key_id: str,
    access_key_secret: str,
    sign_name: str,
    template_code: str,
    phone: str,
    template_param: dict,
) -> None:
    resp = send_sms(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
        phone=phone,
        sign_name=sign_name,
        template_code=template_code,
        template_param=template_param,
    )
    if resp.get("Code") != "OK":
        raise RuntimeError(resp.get("Message", "SMS send failed"))
