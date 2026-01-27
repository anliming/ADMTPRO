import { useState } from "react";
import { listAudit } from "../services/api";
import { useToken } from "../store";
import Modal from "../ui/Modal";

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
  before?: unknown;
  after?: unknown;
  created_at: string;
};

export default function AuditLogPage() {
  const { token, setToken } = useToken();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [result, setResult] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const [message, setMessage] = useState("");

  async function handleLoad() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    try {
      const data = await listAudit(token, { actor, action, target, result, limit: 100 });
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
        <input className="input" placeholder="result(ok/error)" value={result} onChange={(e) => setResult(e.target.value)} />
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
            if (result) qs.set("result", result);
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
            <th>详情</th>
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
              <td>
                <button
                  className="button secondary"
                  onClick={() => {
                    setSelected(it);
                    setDetailOpen(true);
                  }}
                >
                  查看
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && <p className="notice">{message}</p>}

      <Modal title="审计详情" open={detailOpen} onClose={() => setDetailOpen(false)}>
        <pre>{JSON.stringify(selected, null, 2)}</pre>
      </Modal>
    </div>
  );
}
