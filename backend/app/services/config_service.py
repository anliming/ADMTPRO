import json
from typing import Any

from ..core.db import get_conn


def get_config(db_url: str) -> dict[str, Any]:
    with get_conn(db_url) as conn:
        rows = conn.execute("SELECT key, value_json FROM system_config").fetchall()
    return {row[0]: row[1] for row in rows}


def set_config(db_url: str, key: str, value: Any) -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO system_config (key, value_json)
            VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()
            """,
            (key, json.dumps(value)),
        )
        conn.execute(
            """
            INSERT INTO system_config_history (key, value_json)
            VALUES (%s, %s)
            """,
            (key, json.dumps(value)),
        )


def list_history(db_url: str, limit: int = 100) -> list[dict]:
    with get_conn(db_url) as conn:
        rows = conn.execute(
            "SELECT id, key, value_json, created_at FROM system_config_history ORDER BY id DESC LIMIT %s",
            (limit,),
        ).fetchall()
    return [
        {"id": r[0], "key": r[1], "value": r[2], "created_at": r[3].isoformat()} for r in rows
    ]


def rollback(db_url: str, history_id: int) -> None:
    with get_conn(db_url) as conn:
        row = conn.execute(
            "SELECT key, value_json FROM system_config_history WHERE id=%s",
            (history_id,),
        ).fetchone()
        if not row:
            return
        key, value = row
        conn.execute(
            """
            INSERT INTO system_config (key, value_json)
            VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()
            """,
            (key, json.dumps(value)),
        )
