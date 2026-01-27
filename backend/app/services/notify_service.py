from ..core.db import get_conn


def list_expiry_notifies(
    db_url: str,
    *,
    username: str = "",
    status: str = "",
    limit: int = 100,
) -> list[dict]:
    where = []
    params = []
    if username:
        where.append("username = %s")
        params.append(username)
    if status:
        where.append("status = %s")
        params.append(status)
    clause = "WHERE " + " AND ".join(where) if where else ""
    sql = (
        "SELECT id, username, days_left, notify_date, status, last_error, created_at "
        "FROM password_expiry_notifies "
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
                "username": row[1],
                "days_left": row[2],
                "notify_date": row[3].isoformat(),
                "status": row[4],
                "last_error": row[5],
                "created_at": row[6].isoformat(),
            }
        )
    return items
