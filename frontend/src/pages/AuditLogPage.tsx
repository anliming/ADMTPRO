import { useState } from "react";
import { listAudit } from "../services/api";
import { useToken } from "../store";

type AuditItem = {
  id: number;
  actor: string;
  actor_role: string;
  action: string;
  target: string;
  result: string;
  ip: string;
  ua: string;
  detail?: string;
  created_at: string;
};

export default function AuditLogPage() {
  const { token, setToken } = useToken();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [message, setMessage] = useState("");

  async function handleLoad() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    try {
      const data = await listAudit(token, { actor, action, target, limit: 100 });
      setItems(data.items || []);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>审计日志</h2>
      <div className="form-row">
        <span className="label">管理员 Token</span>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="actions">
        <input className="input" placeholder="actor" value={actor} onChange={(e) => setActor(e.target.value)} />
        <input className="input" placeholder="action" value={action} onChange={(e) => setAction(e.target.value)} />
        <input className="input" placeholder="target" value={target} onChange={(e) => setTarget(e.target.value)} />
        <button className="button" onClick={handleLoad}>
          查询
        </button>
        <button
          className="button secondary"
          onClick={() => {
            if (!token.trim()) {
              setMessage("请输入管理员 Token");
              return;
            }
            const qs = new URLSearchParams();
            if (actor) qs.set("actor", actor);
            if (action) qs.set("action", action);
            if (target) qs.set("target", target);
            window.open(`/api/audit/export?${qs.toString()}`, "_blank");
          }}
        >
          导出 CSV
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>时间</th>
            <th>操作者</th>
            <th>角色</th>
            <th>动作</th>
            <th>目标</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.created_at}</td>
              <td>{it.actor}</td>
              <td>{it.actor_role}</td>
              <td>{it.action}</td>
              <td>{it.target}</td>
              <td>{it.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
