import { useState } from "react";
import { emailReset, forgotReset, sendEmailCode, sendSmsCode } from "../services/api";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [method, setMethod] = useState<"sms" | "email">("sms");

  const strength = getStrength(newPassword);

  async function handleSendCode() {
    if (!username.trim()) {
      setMessage("请输入账号");
      return;
    }
    try {
      const res = method === "sms" ? await sendSmsCode(username, "forgot") : await sendEmailCode(username);
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
      if (method === "sms") {
        await forgotReset(username, code, newPassword);
      } else {
        await emailReset(username, code, newPassword);
      }
      setMessage("密码已重置");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>忘记密码</h2>
      <div className="actions">
        <label className="badge">
          <input
            type="radio"
            name="method"
            checked={method === "sms"}
            onChange={() => setMethod("sms")}
          />{" "}
          短信
        </label>
        <label className="badge">
          <input
            type="radio"
            name="method"
            checked={method === "email"}
            onChange={() => setMethod("email")}
          />{" "}
          邮箱
        </label>
      </div>
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
          <span className="badge">强度：{strength}</span>
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

function getStrength(pwd: string): string {
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  if (score <= 2) return "弱";
  if (score === 3) return "中";
  return "强";
}
