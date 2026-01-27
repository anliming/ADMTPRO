from typing import Any, Optional

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer


def _serializer(secret: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret_key=secret)


def issue_token(secret: str, payload: dict[str, Any]) -> str:
    serializer = _serializer(secret)
    return serializer.dumps(payload)


def verify_token(secret: str, token: str, max_age: int) -> Optional[dict[str, Any]]:
    serializer = _serializer(secret)
    try:
        data = serializer.loads(token, max_age=max_age)
        return data
    except (BadSignature, SignatureExpired):
        return None
