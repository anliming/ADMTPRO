from datetime import datetime, timedelta, timezone
from typing import Optional

import pyotp

from ..core.db import get_conn


def get_secret(db_url: str, username: str) -> Optional[dict]:
    with get_conn(db_url) as conn:
        row = conn.execute(
            "SELECT username, secret, enabled FROM otp_secrets WHERE username = %s",
            (username,),
        ).fetchone()
        if not row:
            return None
        return {"username": row[0], "secret": row[1], "enabled": row[2]}


def create_secret(db_url: str, username: str) -> str:
    secret = pyotp.random_base32()
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO otp_secrets (username, secret, enabled)
            VALUES (%s, %s, FALSE)
            ON CONFLICT (username)
            DO UPDATE SET secret = EXCLUDED.secret, enabled = FALSE, updated_at = NOW()
            """,
            (username, secret),
        )
    return secret


def enable_secret(db_url: str, username: str) -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            "UPDATE otp_secrets SET enabled = TRUE, updated_at = NOW() WHERE username = %s",
            (username,),
        )


def verify_code(secret: str, code: str, window: int) -> bool:
    totp = pyotp.TOTP(secret, interval=window)
    return totp.verify(code, valid_window=1)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def record_action_otp(db_url: str, username: str, ttl_minutes: int) -> None:
    expires_at = _now() + timedelta(minutes=ttl_minutes)
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO admin_otp_sessions (username, verified_at, expires_at)
            VALUES (%s, NOW(), %s)
            ON CONFLICT (username)
            DO UPDATE SET verified_at = NOW(), expires_at = EXCLUDED.expires_at
            """,
            (username, expires_at),
        )


def has_valid_action_otp(db_url: str, username: str) -> bool:
    with get_conn(db_url) as conn:
        row = conn.execute(
            "SELECT expires_at FROM admin_otp_sessions WHERE username = %s",
            (username,),
        ).fetchone()
        if not row:
            return False
        (expires_at,) = row
        return expires_at is not None and expires_at > _now()
