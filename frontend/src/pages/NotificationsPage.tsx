import { useState } from "react";
import { listNotifications } from "../services/api";
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

export default function NotificationsPage() {
  const { token, setToken } = useToken();
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");

  async function handleLoad() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入 Token");
      return;
    }
    try {
      const data = await listNotifications(token);
      setItems(data.items || []);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>站内通知</h2>
      <div className="form-row">
        <span className="label">Token</span>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="actions">
        <button className="button" onClick={handleLoad}>
          刷新
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>提醒日期</th>
            <th>剩余天数</th>
            <th>状态</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.notify_date}</td>
              <td>{it.days_left}</td>
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
