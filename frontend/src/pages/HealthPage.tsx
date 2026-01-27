import { useEffect, useState } from "react";
import { getHealthDetails } from "../services/api";

export default function HealthPage() {
  const [status, setStatus] = useState<{ api: boolean; db: boolean; ldap: boolean } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getHealthDetails()
      .then((data) => setStatus(data))
      .catch(() => setMessage("健康检查失败"));
  }, []);

  return (
    <div className="panel">
      <h2>系统健康</h2>
      {status && (
        <div className="form">
          <div className="form-row">
            <span className="label">API</span>
            <span className="badge">{status.api ? "OK" : "FAIL"}</span>
          </div>
          <div className="form-row">
            <span className="label">DB</span>
            <span className="badge">{status.db ? "OK" : "FAIL"}</span>
          </div>
          <div className="form-row">
            <span className="label">LDAP</span>
            <span className="badge">{status.ldap ? "OK" : "FAIL"}</span>
          </div>
        </div>
      )}
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
