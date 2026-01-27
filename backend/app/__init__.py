from flask import Flask
from .core.config import load_config, apply_overrides
from .core.db import init_db
from .services.sms_retry import start_sms_retry_loop
from .services.password_expiry import start_password_expiry_loop
from .adapters.ldap_client import LDAPClient
from .services.config_service import get_config
from .api.routes import api_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.update(load_config())
    if app.config.get("DB_URL"):
        init_db(app.config["DB_URL"])
        overrides = get_config(app.config["DB_URL"])
        if overrides:
            apply_overrides(app.config, overrides)
        if app.config.get("SMS_AUTO_RETRY"):
            start_sms_retry_loop(
                db_url=app.config["DB_URL"],
                interval_seconds=app.config["SMS_RETRY_INTERVAL"],
                access_key_id=app.config["ALIYUN_ACCESS_KEY_ID"],
                access_key_secret=app.config["ALIYUN_ACCESS_KEY_SECRET"],
                sign_name=app.config["ALIYUN_SMS_SIGN_NAME"],
                template_code=app.config["ALIYUN_SMS_TEMPLATE_RESET"],
            )
        if app.config.get("PASSWORD_EXPIRY_ENABLE"):
            start_password_expiry_loop(
                ldap_client_factory=lambda: LDAPClient(
                    url=app.config["LDAP_URL"],
                    bind_dn=app.config["LDAP_BIND_DN"],
                    bind_password=app.config["LDAP_BIND_PASSWORD"],
                    base_dn=app.config["LDAP_BASE_DN"],
                    ca_cert=app.config["LDAP_CA_CERT"],
                ),
                db_url=app.config["DB_URL"],
                days_value=app.config["PASSWORD_EXPIRY_DAYS"],
                interval_seconds=app.config["PASSWORD_EXPIRY_CHECK_INTERVAL"],
                aliyun_access_key_id=app.config["ALIYUN_ACCESS_KEY_ID"],
                aliyun_access_key_secret=app.config["ALIYUN_ACCESS_KEY_SECRET"],
                aliyun_sign_name=app.config["ALIYUN_SMS_SIGN_NAME"],
                aliyun_template_code=app.config["ALIYUN_SMS_TEMPLATE_NOTIFY"],
            )
        app.config["SMS_RETRY_LOOP_STARTED"] = app.config.get("SMS_AUTO_RETRY", False)
        app.config["EXPIRY_LOOP_STARTED"] = app.config.get("PASSWORD_EXPIRY_ENABLE", False)

    app.register_blueprint(api_bp, url_prefix="/api")
    return app
