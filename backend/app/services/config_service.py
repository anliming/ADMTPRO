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
