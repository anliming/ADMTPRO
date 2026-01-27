import { useState } from "react";
import { listSms, retrySms } from "../services/api";
import { useToken } from "../store";

type SmsItem = {
  id: number;
  username: string;
  phone: string;
  scene: string;
  code: string;
  send_status: string;
  send_attempts: number;
  last_error?: string;
  sent_at: string;
  expires_at: string;
  used_at?: string | null;
};

export default function SmsLogPage() {
  const { token, setToken } = useToken();
  const [username, setUsername] = useState("");
  const [scene, setScene] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<SmsItem[]>([]);
  const [message, setMessage] = useState("");

  async function handleLoad() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    try {
      const data = await listSms(token, { username, scene, status, limit: 100 });
      setItems(data.items || []);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleRetry() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    try {
      const data = await retrySms(token);
      setMessage(`已重试 ${data.retried} 条，错误 ${data.errors} 条`);
      await handleLoad();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>短信发送日志</h2>
      <div className="form-row">
        <span className="label">管理员 Token</span>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="actions">
        <input className="input" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" placeholder="scene" value={scene} onChange={(e) => setScene(e.target.value)} />
        <input className="input" placeholder="status" value={status} onChange={(e) => setStatus(e.target.value)} />
        <button className="button" onClick={handleLoad}>
          查询
        </button>
        <button className="button secondary" onClick={handleRetry}>
          失败重试
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>账号</th>
            <th>手机号</th>
            <th>场景</th>
            <th>状态</th>
            <th>尝试</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.username}</td>
              <td>{it.phone}</td>
              <td>{it.scene}</td>
              <td>{it.send_status}</td>
              <td>{it.send_attempts}</td>
              <td>{it.sent_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
