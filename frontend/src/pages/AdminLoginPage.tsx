import { useState } from "react";
import { login, otpSetup, otpVerify } from "../services/api";
import { useToken } from "../store";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [setupUri, setSetupUri] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { setToken } = useToken();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!username.trim() || !password.trim()) {
      setMessage("请输入账号和密码");
      return;
    }
    try {
      const data = await login(username, password, "admin");
      if (data.otp_required) {
        setOtpToken(data.otp_token || "");
        if (data.otp_setup_required) {
          const setup = await otpSetup(data.otp_token || "");
          setSetupUri(setup.otpauth_uri);
          setMessage("请使用 OTP 应用扫码绑定后输入验证码");
          return;
        }
        setMessage("请输入 OTP 验证码完成登录");
        return;
      }
      setMessage(`已登录：${JSON.stringify(data.user)}`);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleVerifyOtp() {
    if (!otpToken) {
      setMessage("请先登录获取 OTP Token");
      return;
    }
    if (!otp.trim()) {
      setMessage("请输入 OTP 验证码");
      return;
    }
    try {
      const res = await otpVerify(otpToken, otp);
      setToken(res.token);
      setMessage("OTP 验证成功，已保存 Token");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>管理员登录</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <span className="label">账号</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="form-row">
          <span className="label">密码</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="form-row">
          <span className="label">OTP</span>
          <input className="input" value={otp} onChange={(e) => setOtp(e.target.value)} />
        </div>
        <div className="actions">
          <button className="button" type="submit">
            登录
          </button>
          <button className="button secondary" type="button" onClick={handleVerifyOtp}>
            验证 OTP
          </button>
        </div>
      </form>
      {setupUri && (
        <p>
          绑定 URI（复制到 OTP 应用）：<br />
          <code>{setupUri}</code>
        </p>
      )}
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
