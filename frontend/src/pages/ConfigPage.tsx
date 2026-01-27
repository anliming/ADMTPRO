import { useEffect, useState } from "react";
import { useToken } from "../store";
import { listConfigHistory, rollbackConfig } from "../services/api";

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
  const [history, setHistory] = useState<{ id: number; key: string; value: unknown; created_at: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    getConfig(token)
      .then((data) => setForm(data))
      .catch((err) => setMessage(err.message));
  }, [token]);
  useEffect(() => {
    if (!token) return;
    listConfigHistory(token, 50)
      .then((data) => setHistory(data.items || []))
      .catch(() => undefined);
  }, [token]);

  return (
    <div className="panel">
      <h2>配置中心</h2>
      {!token && <p className="notice">请先以管理员登录</p>}
      {token && (
        <div className="form">
          <h3>LDAP</h3>
          {["LDAP_URL", "LDAP_BASE_DN", "ADMIN_GROUP_DN"].map((key) => (
            <div className="form-row" key={key}>
              <span className="label">{key}</span>
              <input
                className="input"
                value={String(form[key] ?? "")}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <h3>OTP</h3>
          {["OTP_ISSUER"].map((key) => (
            <div className="form-row" key={key}>
              <span className="label">{key}</span>
              <input
                className="input"
                value={String(form[key] ?? "")}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <h3>短信</h3>
          {["SMS_SEND_INTERVAL", "SMS_CODE_TTL"].map((key) => (
            <div className="form-row" key={key}>
              <span className="label">{key}</span>
              <input
                className="input"
                value={String(form[key] ?? "")}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <h3>到期提醒</h3>
          {["PASSWORD_EXPIRY_ENABLE", "PASSWORD_EXPIRY_DAYS", "PASSWORD_EXPIRY_CHECK_INTERVAL"].map((key) => (
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
                  setMessage("已保存并覆盖运行时配置");
                } catch (err) {
                  setMessage((err as Error).message);
                }
              }}
            >
              保存
            </button>
          </div>

          <h3>配置历史</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Key</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>{h.key}</td>
                  <td>{h.created_at}</td>
                  <td>
                    <button
                      className="button secondary"
                      onClick={async () => {
                        try {
                          await rollbackConfig(token, h.id);
                          setMessage("已回滚");
                        } catch (err) {
                          setMessage((err as Error).message);
                        }
                      }}
                    >
                      回滚
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
