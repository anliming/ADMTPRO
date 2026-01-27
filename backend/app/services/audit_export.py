import csv
import io

from .audit_service import list_logs


def export_csv(
    db_url: str,
    *,
    actor: str = "",
    action: str = "",
    target: str = "",
    result: str = "",
    limit: int = 1000,
) -> str:
    items = list_logs(db_url, actor=actor, action=action, target=target, result=result, limit=limit)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["id", "created_at", "actor", "role", "action", "target", "result", "ip", "ua", "detail", "before", "after"]
    )
    for it in items:
        writer.writerow(
            [
                it.get("id"),
                it.get("created_at"),
                it.get("actor"),
                it.get("actor_role"),
                it.get("action"),
                it.get("target"),
                it.get("result"),
                it.get("ip"),
                it.get("ua"),
                it.get("detail"),
                it.get("before"),
                it.get("after"),
            ]
        )
    return output.getvalue()
