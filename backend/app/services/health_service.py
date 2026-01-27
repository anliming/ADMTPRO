from ..core.db import get_conn
from ..adapters.ldap_client import LDAPClient


def check_db(db_url: str) -> bool:
    try:
        with get_conn(db_url) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


def check_ldap(ldap_client: LDAPClient) -> bool:
    try:
        conn = ldap_client._service_conn()
        conn.unbind()
        return True
    except Exception:
        return False
