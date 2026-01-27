import { useState } from "react";
import { changePassword, me, sendSmsCode } from "../services/api";
import { useToken } from "../store";

export default function MePage() {
  const { token, setToken } = useToken();
  const [info, setInfo] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");

  async function handleLoad() {
    setError("");
    setInfo("");
    if (!token.trim()) {
      setError("请输入 Token");
      return;
    }
    try {
      const data = await me(token);
      setInfo(JSON.stringify(data));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>个人中心（调试）</h2>
      <div className="form-row">
        <span className="label">Token</span>
        <div className="actions">
          <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
          <button className="button" type="button" onClick={handleLoad}>
            读取我的信息
          </button>
        </div>
      </div>
      {info && <pre>{info}</pre>}
      {error && <p className="notice">{error}</p>}
      <h3>修改密码</h3>
      <div className="form-row">
        <span className="label">旧密码</span>
        <input
          className="input"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
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
      <div className="form-row">
        <span className="label">短信验证码</span>
        <div className="actions">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
          <button
            className="button secondary"
            type="button"
            onClick={async () => {
              if (!token.trim()) {
                setError("请输入 Token");
                return;
              }
              try {
                const data = await me(token);
                const username = String(data.sAMAccountName || "");
                if (!username) {
                  setError("无法读取账号");
                  return;
                }
                const res = await sendSmsCode(username, "change");
                if (res.dev_code) {
                  setError(`验证码已发送（开发码：${res.dev_code}）`);
                } else {
                  setError("验证码已发送");
                }
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            发送验证码
          </button>
        </div>
      </div>
      <div className="actions">
        <button
          className="button"
          type="button"
          onClick={async () => {
            if (!token.trim() || !oldPassword || !newPassword || !code) {
              setError("请填写 Token/旧密码/新密码/验证码");
              return;
            }
            try {
              await changePassword(token, oldPassword, newPassword, code);
              setError("密码修改成功");
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          修改密码
        </button>
      </div>
    </div>
  );
}
