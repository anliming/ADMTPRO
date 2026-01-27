import { useState } from "react";
import { login } from "../services/api";
import { useToken } from "../store";

type Props = {
  onForgot?: () => void;
};

export default function LoginPage({ onForgot }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      const data = await login(username, password, "user");
      if (data.token) {
        setToken(data.token);
      }
      setMessage(`登录成功：${JSON.stringify(data.user)}`);
    } catch (err) {
      const message = (err as Error).message;
      setMessage(message);
    }
  }

  return (
    <div className="panel">
      <h2>普通用户登录</h2>
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
        <div className="actions">
          <button className="button" type="submit">
            登录
          </button>
          <button className="button secondary" type="button" onClick={onForgot}>
            忘记密码
          </button>
        </div>
      </form>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
