import { useState } from "react";
import { forgotReset, sendSmsCode } from "../services/api";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSendCode() {
    if (!username.trim()) {
      setMessage("请输入账号");
      return;
    }
    try {
      const res = await sendSmsCode(username, "forgot");
      if (res.dev_code) {
        setMessage(`验证码已发送（开发码：${res.dev_code}）`);
      } else {
        setMessage("验证码已发送");
      }
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !newPassword.trim()) {
      setMessage("请输入验证码和新密码");
      return;
    }
    try {
      await forgotReset(username, code, newPassword);
      setMessage("密码已重置");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>忘记密码</h2>
      <div className="form-row">
        <span className="label">账号</span>
        <div className="actions">
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button className="button secondary" type="button" onClick={handleSendCode}>
            发送验证码
          </button>
        </div>
      </div>
      <form className="form" onSubmit={handleReset}>
        <div className="form-row">
          <span className="label">短信验证码</span>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="form-row">
          <span className="label">新密码</span>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="actions">
          <button className="button" type="submit">
            重置密码
          </button>
        </div>
      </form>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
