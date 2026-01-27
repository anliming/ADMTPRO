import { useEffect, useState } from "react";
import { useToken } from "../store";

async function getConfig(token: string) {
  const res = await fetch("/api/config", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("config load failed");
  return res.json();
}

async function setConfig(token: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("config save failed");
  return res.json();
}

export default function ConfigPage() {
  const { token } = useToken();
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    getConfig(token)
      .then((data) => setForm(data))
      .catch((err) => setMessage(err.message));
  }, [token]);

  return (
    <div className="panel">
      <h2>配置中心</h2>
      {!token && <p className="notice">请先以管理员登录</p>}
      {token && (
        <div className="form">
          {[
            "LDAP_URL",
            "LDAP_BASE_DN",
            "ADMIN_GROUP_DN",
            "OTP_ISSUER",
            "SMS_SEND_INTERVAL",
            "SMS_CODE_TTL",
            "PASSWORD_EXPIRY_ENABLE",
            "PASSWORD_EXPIRY_DAYS",
            "PASSWORD_EXPIRY_CHECK_INTERVAL"
          ].map((key) => (
            <div className="form-row" key={key}>
              <span className="label">{key}</span>
              <input
                className="input"
                value={String(form[key] ?? "")}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="actions">
            <button
              className="button"
              onClick={async () => {
                try {
                  await setConfig(token, form);
                  setMessage("已保存（仅覆盖配置表，不自动热更新运行时）");
                } catch (err) {
                  setMessage((err as Error).message);
                }
              }}
            >
              保存
            </button>
          </div>
        </div>
      )}
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
