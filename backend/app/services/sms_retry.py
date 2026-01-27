import threading
import time

from ..services.sms_service import mark_failed, mark_sent, retry_pending, send_via_aliyun


def start_sms_retry_loop(
    *,
    db_url: str,
    interval_seconds: int,
    access_key_id: str,
    access_key_secret: str,
    sign_name: str,
    template_code: str,
) -> None:
    if not all([db_url, access_key_id, access_key_secret, sign_name, template_code]):
        return

    def _loop() -> None:
        while True:
            items = retry_pending(db_url, limit=10)
            for item in items:
                try:
                    send_via_aliyun(
                        access_key_id=access_key_id,
                        access_key_secret=access_key_secret,
                        sign_name=sign_name,
                        template_code=template_code,
                        phone=item["phone"],
                        template_param={"code": item["code"]},
                    )
                    mark_sent(db_url, item["username"], item["scene"], item["code"])
                except Exception as exc:
                    mark_failed(db_url, item["username"], item["scene"], item["code"], str(exc))
            time.sleep(interval_seconds)

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
