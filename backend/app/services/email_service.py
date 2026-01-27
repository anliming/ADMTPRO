import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from ..core.db import get_conn


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_code(db_url: str, username: str, email: str, scene: str, ttl_seconds: int) -> str:
    code = f"{random.randint(0, 999999):06d}"
    expires_at = _now() + timedelta(seconds=ttl_seconds)
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO email_codes (username, email, scene, code, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (username, email, scene, code, expires_at),
        )
    return code


def verify_code(db_url: str, username: str, scene: str, code: str) -> bool:
    with get_conn(db_url) as conn:
        row = conn.execute(
            """
            SELECT id, expires_at, used_at FROM email_codes
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
        conn.execute("UPDATE email_codes SET used_at = NOW() WHERE id = %s", (code_id,))
        return True


def send_email(
    *,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_from: str,
    to_email: str,
    subject: str,
    body: str,
) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.send_message(msg)
