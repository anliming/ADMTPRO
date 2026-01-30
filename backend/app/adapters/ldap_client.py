import logging
import ssl
from datetime import datetime, timedelta, timezone
from typing import Optional

from ldap3 import Server, Connection, ALL, BASE, MODIFY_REPLACE, Tls
from ldap3.core.exceptions import LDAPException

from ..core.errors import ADConnectionError, ADAuthError

logger = logging.getLogger(__name__)


class LDAPClient:
    def __init__(
        self,
        url: str,
        bind_dn: str,
        bind_password: str,
        base_dn: str,
        ca_cert: str,
        tls_verify: bool = True,
        tls_allow_weak: bool = False,
    ) -> None:
        self.url = url
        self.bind_dn = bind_dn
        self.bind_password = bind_password
        self.base_dn = base_dn
        self.ca_cert = ca_cert
        self.tls_verify = tls_verify
        self.tls_allow_weak = tls_allow_weak

    def _server(self) -> Server:
        tls = None
        if self.url.lower().startswith("ldaps") and self.ca_cert:
            validate = ssl.CERT_REQUIRED if self.tls_verify else ssl.CERT_NONE
            ciphers = "DEFAULT:@SECLEVEL=0" if self.tls_allow_weak else None
            tls = Tls(validate=validate, ca_certs_file=self.ca_cert, ciphers=ciphers)
        return Server(self.url, get_info=ALL, tls=tls)

    def _service_conn(self) -> Connection:
        try:
            conn = Connection(self._server(), user=self.bind_dn, password=self.bind_password, auto_bind=True)
        except LDAPException as exc:
            logger.error("AD service bind failed: bind_dn=%s error=%s", self.bind_dn, exc)
            raise ADConnectionError(str(exc)) from exc
        return conn

    def get_user_dn(self, username: str) -> Optional[str]:
        conn = self._service_conn()
        search_filter = f"(sAMAccountName={username})"
        if not conn.search(self.base_dn, search_filter, attributes=["distinguishedName"]):
            logger.warning("AD search user dn failed: username=%s result=%s", username, conn.result)
            return None
        if not conn.entries:
            return None
        return str(conn.entries[0].entry_dn)

    def authenticate_user(self, username: str, password: str) -> bool:
        user_dn = self.get_user_dn(username)
        if not user_dn:
            return False
        try:
            conn = Connection(self._server(), user=user_dn, password=password, auto_bind=True)
            conn.unbind()
            return True
        except LDAPException:
            logger.warning("AD user bind failed: username=%s dn=%s", username, user_dn)
            return False

    def get_user_info(self, username: str) -> Optional[dict]:
        conn = self._service_conn()
        search_filter = f"(sAMAccountName={username})"
        if not conn.search(
            self.base_dn,
            search_filter,
            attributes=[
                "sAMAccountName",
                "displayName",
                "mail",
                "mobile",
                "department",
                "title",
                "memberOf",
                "msDS-UserPasswordExpiryTimeComputed",
                "userAccountControl",
                "accountExpires",
            ],
        ):
            return None
        if not conn.entries:
            return None
        entry = conn.entries[0]
        expiry_raw = getattr(entry, "msDS-UserPasswordExpiryTimeComputed", None)
        expiry_dt = _filetime_to_datetime(expiry_raw.value if expiry_raw else None)
        days_left = None
        expiry_date = None
        if expiry_dt:
            now = datetime.now(timezone.utc)
            days_left = max((expiry_dt - now).days, 0)
            expiry_date = expiry_dt.date().isoformat()
        account_raw = getattr(entry, "accountExpires", None)
        account_dt = _filetime_to_datetime(account_raw.value if account_raw else None)
        account_expiry_date = account_dt.date().isoformat() if account_dt else None
        uac = getattr(entry, "userAccountControl", None)
        uac_value = uac.value if uac else 0
        pwd_never_expires = False
        try:
            pwd_never_expires = bool(int(uac_value) & 0x10000)
        except Exception:
            pwd_never_expires = False
        return {
            "sAMAccountName": getattr(entry, "sAMAccountName", None).value,
            "displayName": getattr(entry, "displayName", None).value,
            "mail": getattr(entry, "mail", None).value,
            "mobile": getattr(entry, "mobile", None).value,
            "department": getattr(entry, "department", None).value,
            "title": getattr(entry, "title", None).value,
            "memberOf": getattr(entry, "memberOf", None).values if hasattr(entry, "memberOf") else [],
            "days_left": days_left,
            "password_expiry_date": expiry_date,
            "account_expiry_date": account_expiry_date,
            "password_never_expires": pwd_never_expires,
        }

    def is_user_admin(self, username: str, admin_group_dn: str) -> bool:
        if not admin_group_dn:
            return False
        user_dn = self.get_user_dn(username)
        if not user_dn:
            return False
        conn = self._service_conn()
        # Check membership by querying the admin group entry directly.
        if not conn.search(
            admin_group_dn,
            f"(member={user_dn})",
            search_scope=BASE,
            attributes=["member"],
        ):
            return False
        return bool(conn.entries)

    def search_users(self, query: str = "", ou_dn: str = "", enabled: Optional[bool] = None) -> list[dict]:
        conn = self._service_conn()
        base = ou_dn or self.base_dn
        # Only return person user objects; exclude computer/builtin accounts.
        filter_parts = ["(objectClass=user)", "(objectClass=person)", "(!(objectClass=computer))"]
        if query:
            q = query.replace("*", "")
            filter_parts.append(
                f"(|(sAMAccountName=*{q}*)(displayName=*{q}*)(cn=*{q}*)(mail=*{q}*)(mobile=*{q}*))"
            )
        if enabled is True:
            filter_parts.append("(!(userAccountControl:1.2.840.113556.1.4.803:=2))")
        if enabled is False:
            filter_parts.append("(userAccountControl:1.2.840.113556.1.4.803:=2)")
        search_filter = f"(&{''.join(filter_parts)})"
        conn.search(
            base,
            search_filter,
            attributes=[
                "sAMAccountName",
                "displayName",
                "mail",
                "mobile",
                "department",
                "title",
                "userAccountControl",
                "msDS-UserPasswordExpiryTimeComputed",
                "accountExpires",
            ],
        )
        users = []
        now = datetime.now(timezone.utc)
        for entry in conn.entries:
            uac = getattr(entry, "userAccountControl", None)
            uac_value = uac.value if uac else 0
            enabled_flag = True
            try:
                enabled_flag = not (int(uac_value) & 2)
            except Exception:
                enabled_flag = True
            pwd_never_expires = False
            try:
                pwd_never_expires = bool(int(uac_value) & 0x10000)
            except Exception:
                pwd_never_expires = False
            expiry_raw = getattr(entry, "msDS-UserPasswordExpiryTimeComputed", None)
            expiry_dt = _filetime_to_datetime(expiry_raw.value if expiry_raw else None)
            password_expiry_date = expiry_dt.date().isoformat() if expiry_dt else None
            days_left = None
            if expiry_dt:
                days_left = max((expiry_dt - now).days, 0)
            account_raw = getattr(entry, "accountExpires", None)
            account_dt = _filetime_to_datetime(account_raw.value if account_raw else None)
            account_expiry_date = account_dt.date().isoformat() if account_dt else None
            users.append(
                {
                    "dn": str(entry.entry_dn),
                    "sAMAccountName": getattr(entry, "sAMAccountName", None).value,
                    "displayName": getattr(entry, "displayName", None).value,
                    "mail": getattr(entry, "mail", None).value,
                    "mobile": getattr(entry, "mobile", None).value,
                    "department": getattr(entry, "department", None).value,
                    "title": getattr(entry, "title", None).value,
                    "enabled": enabled_flag,
                    "days_left": days_left,
                    "password_expiry_date": password_expiry_date,
                    "account_expiry_date": account_expiry_date,
                    "password_never_expires": pwd_never_expires,
                }
            )
        return users

    def create_user(
        self,
        *,
        sAMAccountName: str,
        displayName: str,
        ou_dn: str,
        password: str,
        attributes: dict,
        force_change: bool = False,
    ) -> None:
        conn = self._service_conn()
        user_dn = f"CN={displayName},{ou_dn}"
        user_principal = f"{sAMAccountName}@{self._domain_from_base_dn()}"
        attrs = {
            "sAMAccountName": sAMAccountName,
            "displayName": displayName,
            "userPrincipalName": user_principal,
            "objectClass": ["top", "person", "organizationalPerson", "user"],
        }
        if attributes.get("password_never_expires"):
            # Create as disabled user with "password never expires" flag set.
            attrs["userAccountControl"] = 0x200 | 0x2 | 0x10000
            attributes = {k: v for k, v in attributes.items() if k != "password_never_expires"}
        attrs.update(attributes)
        if not conn.add(user_dn, attributes=attrs):
            logger.error("AD create user failed: dn=%s result=%s", user_dn, conn.result)
            raise ADConnectionError(conn.result.get("message", "add failed"))
        self._set_password(conn, user_dn, password)
        if force_change:
            self._set_pwd_must_change(conn, user_dn)
        self._set_enabled(conn, user_dn, True)

    def update_user(self, user_dn: str, changes: dict) -> None:
        conn = self._service_conn()
        if "password_never_expires" in changes:
            current_uac = 512
            conn.search(user_dn, "(objectClass=*)", attributes=["userAccountControl"])
            if conn.entries:
                current_uac = getattr(conn.entries[0], "userAccountControl", None).value or 512
            try:
                current_uac = int(current_uac)
            except Exception:
                current_uac = 512
            if changes["password_never_expires"]:
                changes["userAccountControl"] = current_uac | 0x10000
            else:
                changes["userAccountControl"] = current_uac & ~0x10000
            changes.pop("password_never_expires", None)
        mod = {k: [(MODIFY_REPLACE, [v])] for k, v in changes.items()}
        if not conn.modify(user_dn, mod):
            logger.error("AD update user failed: dn=%s changes=%s result=%s", user_dn, changes, conn.result)
            raise ADConnectionError(conn.result.get("message", "modify failed"))

    def set_user_enabled(self, user_dn: str, enabled: bool) -> None:
        conn = self._service_conn()
        self._set_enabled(conn, user_dn, enabled)

    def reset_password(self, user_dn: str, new_password: str, force_change: bool = False) -> None:
        conn = self._service_conn()
        self._set_password(conn, user_dn, new_password)
        if force_change:
            self._set_pwd_must_change(conn, user_dn)

    def change_password(self, username: str, old_password: str, new_password: str) -> None:
        user_dn = self.get_user_dn(username)
        if not user_dn:
            raise ADConnectionError("user not found")
        try:
            conn = Connection(self._server(), user=user_dn, password=old_password, auto_bind=True)
        except LDAPException as exc:
            logger.warning("AD change password bind failed: username=%s dn=%s", username, user_dn)
            raise ADConnectionError("old password invalid") from exc
        self._set_password(conn, user_dn, new_password)

    def delete_user(self, user_dn: str) -> None:
        conn = self._service_conn()
        if not conn.delete(user_dn):
            raise ADConnectionError(conn.result.get("message", "delete failed"))

    def move_user(self, user_dn: str, target_ou_dn: str) -> None:
        conn = self._service_conn()
        new_rdn = user_dn.split(",", 1)[0]
        if not conn.modify_dn(user_dn, new_rdn, new_superior=target_ou_dn):
            raise ADConnectionError(conn.result.get("message", "move failed"))

    def list_ous(self, base_dn: str = "") -> list[dict]:
        conn = self._service_conn()
        base = base_dn or self.base_dn
        conn.search(base, "(objectClass=organizationalUnit)", attributes=["ou", "description"])
        ous = []
        for entry in conn.entries:
            ous.append(
                {
                    "dn": str(entry.entry_dn),
                    "name": getattr(entry, "ou", None).value,
                    "description": getattr(entry, "description", None).value,
                }
            )
        return ous

    def list_users_password_expiring(self, max_days: int) -> list[dict]:
        conn = self._service_conn()
        base = self.base_dn
        search_filter = "(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
        conn.search(
            base,
            search_filter,
            attributes=[
                "sAMAccountName",
                "displayName",
                "mail",
                "mobile",
                "msDS-UserPasswordExpiryTimeComputed",
            ],
        )
        items = []
        now = datetime.now(timezone.utc)
        for entry in conn.entries:
            expiry_raw = getattr(entry, "msDS-UserPasswordExpiryTimeComputed", None)
            expiry_dt = _filetime_to_datetime(expiry_raw.value if expiry_raw else None)
            if not expiry_dt:
                continue
            days_left = (expiry_dt - now).days
            if days_left < 0 or days_left > max_days:
                continue
            items.append(
                {
                    "sAMAccountName": getattr(entry, "sAMAccountName", None).value,
                    "displayName": getattr(entry, "displayName", None).value,
                    "mail": getattr(entry, "mail", None).value,
                    "mobile": getattr(entry, "mobile", None).value,
                    "days_left": days_left,
                }
            )
        return items

    def get_password_policy(self) -> dict:
        conn = self._service_conn()
        # Domain password policy is stored on the domain root object.
        conn.search(
            self.base_dn,
            "(objectClass=domainDNS)",
            search_scope=BASE,
            attributes=[
                "minPwdLength",
                "pwdHistoryLength",
                "maxPwdAge",
                "minPwdAge",
                "pwdProperties",
                "lockoutThreshold",
            ],
        )
        if not conn.entries:
            return {}
        entry = conn.entries[0]
        min_len = _to_int(getattr(entry, "minPwdLength", None))
        history_len = _to_int(getattr(entry, "pwdHistoryLength", None))
        max_age = _interval_to_days(getattr(entry, "maxPwdAge", None))
        min_age = _interval_to_days(getattr(entry, "minPwdAge", None))
        pwd_props = _to_int(getattr(entry, "pwdProperties", None))
        lockout = _to_int(getattr(entry, "lockoutThreshold", None))
        return {
            "min_length": min_len,
            "history_length": history_len,
            "max_age_days": max_age,
            "min_age_days": min_age,
            "pwd_properties": pwd_props,
            "lockout_threshold": lockout,
            "complexity_enabled": bool(pwd_props & 1) if pwd_props is not None else None,
            "reversible_encryption": bool(pwd_props & 128) if pwd_props is not None else None,
        }

    def create_ou(self, name: str, parent_dn: str, description: str = "") -> None:
        conn = self._service_conn()
        ou_dn = f"OU={name},{parent_dn}"
        attrs = {"ou": name, "objectClass": ["top", "organizationalUnit"]}
        if description:
            attrs["description"] = description
        if not conn.add(ou_dn, attributes=attrs):
            raise ADConnectionError(conn.result.get("message", "add ou failed"))

    def update_ou(self, ou_dn: str, name: Optional[str], description: Optional[str]) -> None:
        conn = self._service_conn()
        if name:
            if not conn.modify_dn(ou_dn, f"OU={name}"):
                raise ADConnectionError(conn.result.get("message", "rename ou failed"))
            ou_dn = f"OU={name}," + ou_dn.split(",", 1)[1]
        if description is not None:
            if not conn.modify(ou_dn, {"description": [(MODIFY_REPLACE, [description])]}):
                raise ADConnectionError(conn.result.get("message", "update ou failed"))

    def delete_ou(self, ou_dn: str) -> None:
        conn = self._service_conn()
        if not conn.delete(ou_dn):
            raise ADConnectionError(conn.result.get("message", "delete ou failed"))

    def _set_password(self, conn: Connection, user_dn: str, password: str) -> None:
        pwd = f'"{password}"'.encode("utf-16-le")
        if not conn.modify(user_dn, {"unicodePwd": [(MODIFY_REPLACE, [pwd])]}):
            logger.error(
                "AD set password failed: dn=%s result=%s",
                user_dn,
                conn.result,
            )
            raise ADConnectionError(conn.result.get("message", "set password failed"))

    def _set_enabled(self, conn: Connection, user_dn: str, enabled: bool) -> None:
        current_uac = 512
        try:
            conn.search(user_dn, "(objectClass=*)", attributes=["userAccountControl"])
            if conn.entries:
                current_uac = getattr(conn.entries[0], "userAccountControl", None).value or 512
            current_uac = int(current_uac)
        except Exception:
            current_uac = 512
        if enabled:
            uac = current_uac & ~0x2
        else:
            uac = current_uac | 0x2
        if not conn.modify(user_dn, {"userAccountControl": [(MODIFY_REPLACE, [uac])]}):
            raise ADConnectionError(conn.result.get("message", "set enabled failed"))

    def _set_pwd_must_change(self, conn: Connection, user_dn: str) -> None:
        if not conn.modify(user_dn, {"pwdLastSet": [(MODIFY_REPLACE, [0])]}):
            raise ADConnectionError(conn.result.get("message", "set pwdLastSet failed"))

    def _domain_from_base_dn(self) -> str:
        parts = []
        for part in self.base_dn.split(","):
            if part.strip().lower().startswith("dc="):
                parts.append(part.split("=", 1)[1])
        return ".".join(parts)


def _filetime_to_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    try:
        if isinstance(value, str):
            value = int(value)
        if value <= 0:
            return None
        base = datetime(1601, 1, 1, tzinfo=timezone.utc)
        return base + timedelta(microseconds=value / 10)
    except Exception:
        return None


def _to_int(value) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(getattr(value, "value", value))
    except Exception:
        return None


def _interval_to_days(value) -> Optional[int]:
    if value is None:
        return None
    try:
        raw = int(getattr(value, "value", value))
        if raw == 0:
            return None
        seconds = abs(raw) / 10_000_000
        return int(seconds // 86400)
    except Exception:
        return None
