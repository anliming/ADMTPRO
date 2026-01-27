from datetime import datetime, timedelta, timezone
from typing import Optional

from ..core.db import get_conn


def _now() -> datetime:
    return datetime.now(timezone.utc)


def record_fail(db_url: str, username: str, max_fails: int, lock_minutes: int) -> None:
    with get_conn(db_url) as conn:
        row = conn.execute(
            "SELECT fail_count FROM login_attempts WHERE username = %s",
            (username,),
        ).fetchone()
        if row:
            fail_count = row[0] + 1
            locked_until = None
            if fail_count >= max_fails:
                locked_until = _now() + timedelta(minutes=lock_minutes)
                fail_count = 0
            conn.execute(
                "UPDATE login_attempts SET fail_count=%s, locked_until=%s WHERE username=%s",
                (fail_count, locked_until, username),
            )
        else:
            fail_count = 1
            locked_until = None
            if fail_count >= max_fails:
                locked_until = _now() + timedelta(minutes=lock_minutes)
                fail_count = 0
            conn.execute(
                "INSERT INTO login_attempts (username, fail_count, locked_until) VALUES (%s, %s, %s)",
                (username, fail_count, locked_until),
            )


def clear_fail(db_url: str, username: str) -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            "UPDATE login_attempts SET fail_count=0, locked_until=NULL WHERE username=%s",
            (username,),
        )


def is_locked(db_url: str, username: str) -> Optional[datetime]:
    with get_conn(db_url) as conn:
        row = conn.execute(
            "SELECT locked_until FROM login_attempts WHERE username=%s",
            (username,),
        ).fetchone()
        if not row:
            return None
        locked_until = row[0]
        if locked_until and locked_until > _now():
            return locked_until
        return None
