import { useState } from "react";
import { listPasswordExpiry, triggerPasswordExpiry } from "../services/api";
import { useToken } from "../store";

type Item = {
  id: number;
  username: string;
  days_left: number;
  notify_date: string;
  status: string;
  last_error?: string;
  created_at: string;
};

export default function PasswordExpiryPage() {
  const { token, setToken } = useToken();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");

  async function handleLoad() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    try {
      const data = await listPasswordExpiry(token, { username, status, limit: 100 });
      setItems(data.items || []);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleTrigger() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    try {
      await triggerPasswordExpiry(token);
      setMessage("已触发一次检查");
      await handleLoad();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>密码到期提醒（管理）</h2>
      <div className="form-row">
        <span className="label">管理员 Token</span>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="actions">
        <input className="input" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" placeholder="status" value={status} onChange={(e) => setStatus(e.target.value)} />
        <button className="button" onClick={handleLoad}>
          查询
        </button>
        <button className="button secondary" onClick={handleTrigger}>
          立即触发
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>账号</th>
            <th>剩余天数</th>
            <th>提醒日期</th>
            <th>状态</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.username}</td>
              <td>{it.days_left}</td>
              <td>{it.notify_date}</td>
              <td>{it.status}</td>
              <td>{it.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
