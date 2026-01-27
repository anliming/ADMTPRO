import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import requests


ALIYUN_ENDPOINT = "https://dysmsapi.aliyuncs.com/"


def _percent_encode(value: str) -> str:
    return quote(value, safe="-_.~")


def _canonicalized_query(params: dict[str, Any]) -> str:
    items = sorted((k, v) for k, v in params.items() if v is not None)
    return "&".join(f"{_percent_encode(str(k))}={_percent_encode(str(v))}" for k, v in items)


def _sign(secret: str, canonicalized_query: str) -> str:
    string_to_sign = f"GET&%2F&{_percent_encode(canonicalized_query)}"
    key = f"{secret}&".encode("utf-8")
    digest = hmac.new(key, string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(digest).decode("utf-8")


def send_sms(
    *,
    access_key_id: str,
    access_key_secret: str,
    phone: str,
    sign_name: str,
    template_code: str,
    template_param: dict[str, Any],
) -> dict[str, Any]:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    params = {
        "Action": "SendSms",
        "PhoneNumbers": phone,
        "SignName": sign_name,
        "TemplateCode": template_code,
        "TemplateParam": json.dumps(template_param, ensure_ascii=False),
        "RegionId": "cn-hangzhou",
        "Format": "JSON",
        "Version": "2017-05-25",
        "AccessKeyId": access_key_id,
        "SignatureMethod": "HMAC-SHA1",
        "SignatureVersion": "1.0",
        "SignatureNonce": str(uuid.uuid4()),
        "Timestamp": timestamp,
    }

    canonicalized_query = _canonicalized_query(params)
    signature = _sign(access_key_secret, canonicalized_query)
    url = f"{ALIYUN_ENDPOINT}?{canonicalized_query}&Signature={_percent_encode(signature)}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()
