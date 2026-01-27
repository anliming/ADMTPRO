from typing import Optional

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
) -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            """
            INSERT INTO audit_logs
              (actor, actor_role, action, target, result, ip, ua, detail)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (actor, actor_role, action, target, result, ip, ua, detail),
        )


def list_logs(
    db_url: str,
    *,
    actor: str = "",
    action: str = "",
    target: str = "",
    limit: int = 100,
) -> list[dict]:
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

    clause = "WHERE " + " AND ".join(where) if where else ""
    sql = (
        "SELECT id, actor, actor_role, action, target, result, ip, ua, detail, created_at "
        "FROM audit_logs "
        f"{clause} "
        "ORDER BY created_at DESC "
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
                "actor": row[1],
                "actor_role": row[2],
                "action": row[3],
                "target": row[4],
                "result": row[5],
                "ip": row[6],
                "ua": row[7],
                "detail": row[8],
                "created_at": row[9].isoformat(),
            }
        )
    return items
