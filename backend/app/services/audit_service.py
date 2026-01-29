from typing import Optional, Tuple

from psycopg.types.json import Json


def _sanitize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    # PostgreSQL TEXT cannot contain NUL bytes.
    return value.replace("\x00", "")

from ..core.db import get_conn


def write_log(
    db_url: str,
    *,
    actor: str,
    actor_role: str,
    action: str,
    target: str,
    result: str,
    ip: str,
    ua: str,
    detail: Optional[str] = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
) -> None:
    before_json = Json(before) if before is not None else None
    after_json = Json(after) if after is not None else None
    actor = _sanitize_text(actor) or ""
    actor_role = _sanitize_text(actor_role) or ""
    action = _sanitize_text(action) or ""
    target = _sanitize_text(target) or ""
    result = _sanitize_text(result) or ""
    ip = _sanitize_text(ip) or ""
    ua = _sanitize_text(ua) or ""
    detail = _sanitize_text(detail)
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO audit_logs
              (actor, actor_role, action, target, result, ip, ua, detail, before_json, after_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (actor, actor_role, action, target, result, ip, ua, detail, before_json, after_json),
        )


def list_logs(
    db_url: str,
    *,
    actor: str = "",
    action: str = "",
    target: str = "",
    result: str = "",
    limit: int = 100,
    offset: int = 0,
) -> Tuple[list[dict], int]:
    where = []
    params = []
    if actor:
        where.append("actor ILIKE %s")
        params.append(f"%{actor}%")
    if action:
        where.append("action ILIKE %s")
        params.append(f"%{action}%")
    if target:
        where.append("target ILIKE %s")
        params.append(f"%{target}%")
    if result:
        where.append("result = %s")
        params.append(result)

    clause = "WHERE " + " AND ".join(where) if where else ""
    count_sql = f"SELECT COUNT(*) FROM audit_logs {clause}"
    sql = (
        "SELECT id, actor, actor_role, action, target, result, ip, ua, detail, before_json, after_json, created_at "
        "FROM audit_logs "
        f"{clause} "
        "ORDER BY created_at DESC "
        "LIMIT %s OFFSET %s"
    )

    with get_conn(db_url) as conn:
        total = conn.execute(count_sql, params).fetchone()[0]
        rows = conn.execute(sql, params + [limit, offset]).fetchall()
    items = []
    for row in rows:
        items.append(
            {
                "id": row[0],
                "actor": row[1],
                "actor_role": row[2],
                "action": row[3],
                "target": row[4],
                "result": row[5],
                "ip": row[6],
                "ua": row[7],
                "detail": row[8],
                "before": row[9],
                "after": row[10],
                "created_at": row[11].isoformat(),
            }
        )
    return items, total
