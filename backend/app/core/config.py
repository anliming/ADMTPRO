import os
from dotenv import load_dotenv


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def load_config() -> dict:
    load_dotenv()
    return {
        "APP_ENV": os.getenv("APP_ENV", "development"),
        "APP_SECRET": os.getenv("APP_SECRET", "change-me"),
        "APP_NAME": os.getenv("APP_NAME", "ADMTPRO"),
        "APP_LOGO_URL": os.getenv("APP_LOGO_URL", ""),
        "APP_FAVICON_URL": os.getenv("APP_FAVICON_URL", ""),
        "APP_LOGIN_BANNER": os.getenv("APP_LOGIN_BANNER", ""),
        "APP_PRIMARY_COLOR": os.getenv("APP_PRIMARY_COLOR", "#4F46E5"),
        "APP_SECONDARY_COLOR": os.getenv("APP_SECONDARY_COLOR", "#F59E0B"),
        "APP_SUPPORT_EMAIL": os.getenv("APP_SUPPORT_EMAIL", ""),
        "APP_SUPPORT_PHONE": os.getenv("APP_SUPPORT_PHONE", ""),
        "APP_FOOTER_TEXT": os.getenv("APP_FOOTER_TEXT", ""),
        "APP_COPYRIGHT": os.getenv("APP_COPYRIGHT", ""),
        "API_HOST": os.getenv("API_HOST", "0.0.0.0"),
        "API_PORT": _get_int("API_PORT", 8000),
        "SESSION_TTL": _get_int("SESSION_TTL", 1800),
        "DB_URL": os.getenv("DB_URL", ""),
        "SMS_CODE_TTL": _get_int("SMS_CODE_TTL", 300),
        "SMS_SEND_INTERVAL": _get_int("SMS_SEND_INTERVAL", 60),
        "LOGIN_MAX_FAILS": _get_int("LOGIN_MAX_FAILS", 5),
        "LOGIN_LOCK_MINUTES": _get_int("LOGIN_LOCK_MINUTES", 10),
        "LDAP_URL": os.getenv("LDAP_URL", ""),
        "LDAP_BIND_DN": os.getenv("LDAP_BIND_DN", ""),
        "LDAP_BIND_PASSWORD": os.getenv("LDAP_BIND_PASSWORD", ""),
        "LDAP_BASE_DN": os.getenv("LDAP_BASE_DN", ""),
        "LDAP_CA_CERT": os.getenv("LDAP_CA_CERT", ""),
        "ADMIN_GROUP_DN": os.getenv("ADMIN_GROUP_DN", ""),
        "OTP_ISSUER": os.getenv("OTP_ISSUER", "ADMTPRO"),
        "OTP_WINDOW": _get_int("OTP_WINDOW", 30),
        "ALIYUN_ACCESS_KEY_ID": os.getenv("ALIYUN_ACCESS_KEY_ID", ""),
        "ALIYUN_ACCESS_KEY_SECRET": os.getenv("ALIYUN_ACCESS_KEY_SECRET", ""),
        "ALIYUN_SMS_SIGN_NAME": os.getenv("ALIYUN_SMS_SIGN_NAME", ""),
        "ALIYUN_SMS_TEMPLATE_RESET": os.getenv("ALIYUN_SMS_TEMPLATE_RESET", ""),
        "ALIYUN_SMS_TEMPLATE_NOTIFY": os.getenv("ALIYUN_SMS_TEMPLATE_NOTIFY", ""),
        "SMS_AUTO_RETRY": os.getenv("SMS_AUTO_RETRY", "false").lower() == "true",
        "SMS_RETRY_INTERVAL": _get_int("SMS_RETRY_INTERVAL", 300),
        "PASSWORD_EXPIRY_ENABLE": os.getenv("PASSWORD_EXPIRY_ENABLE", "false").lower() == "true",
        "PASSWORD_EXPIRY_DAYS": os.getenv("PASSWORD_EXPIRY_DAYS", "7,3,1"),
        "PASSWORD_EXPIRY_CHECK_INTERVAL": _get_int("PASSWORD_EXPIRY_CHECK_INTERVAL", 3600),
        "SMTP_HOST": os.getenv("SMTP_HOST", ""),
        "SMTP_PORT": _get_int("SMTP_PORT", 587),
        "SMTP_USER": os.getenv("SMTP_USER", ""),
        "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", ""),
        "SMTP_FROM": os.getenv("SMTP_FROM", ""),
    }


def _to_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).lower() in {"1", "true", "yes", "on"}


def apply_overrides(config: dict, overrides: dict) -> dict:
    for key, value in overrides.items():
        if key in {"PASSWORD_EXPIRY_ENABLE", "SMS_AUTO_RETRY"}:
            config[key] = _to_bool(value)
        elif key in {
            "SMS_SEND_INTERVAL",
            "SMS_CODE_TTL",
            "PASSWORD_EXPIRY_CHECK_INTERVAL",
            "LOGIN_MAX_FAILS",
            "LOGIN_LOCK_MINUTES",
        }:
            try:
                config[key] = int(value)
            except Exception:
                pass
        else:
            config[key] = value
    return config
