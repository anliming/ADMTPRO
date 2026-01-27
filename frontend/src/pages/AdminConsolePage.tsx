import { useEffect, useState } from "react";
import {
  listUsers,
  createUser,
  updateUser,
  setUserStatus,
  resetUserPassword,
  deleteUser,
  moveUser,
  listOus,
  createOu,
  updateOu,
  deleteOu
} from "../services/api";
import { useToken } from "../store";

type Tab = "users" | "ous";

type User = {
  dn: string;
  sAMAccountName: string;
  displayName?: string;
  mail?: string;
  mobile?: string;
  department?: string;
  title?: string;
};

type Ou = {
  dn: string;
  name?: string;
  description?: string;
};

export default function AdminConsolePage() {
  const [tab, setTab] = useState<Tab>("users");
  const { token, setToken } = useToken();
  const [message, setMessage] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [ous, setOus] = useState<Ou[]>([]);

  const [q, setQ] = useState("");
  const [ouFilter, setOuFilter] = useState("");
  const [status, setStatus] = useState("");

  const [newUser, setNewUser] = useState({
    sAMAccountName: "",
    displayName: "",
    ouDn: "",
    password: "",
    mail: "",
    mobile: "",
    department: "",
    title: ""
  });

  const [newOu, setNewOu] = useState({ name: "", parentDn: "", description: "" });

  useEffect(() => {
    setMessage("");
  }, [tab]);

  async function loadUsers() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    const data = await listUsers(token, { q, ou: ouFilter, status });
    setUsers(data.items || []);
  }

  async function loadOus() {
    setMessage("");
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    const data = await listOus(token);
    setOus(data.items || []);
  }

  async function handleCreateUser() {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!newUser.sAMAccountName || !newUser.displayName || !newUser.ouDn || !newUser.password) {
      setMessage("创建用户需填写账号/姓名/OU DN/初始密码");
      return;
    }
    await createUser(token, newUser);
    setMessage("用户创建成功");
    await loadUsers();
  }

  async function handleUpdateUser(username: string) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    const mail = prompt("邮箱", "") || "";
    await updateUser(token, username, { mail });
    setMessage("用户更新成功");
    await loadUsers();
  }

  async function handleToggleUser(username: string, enabled: boolean) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    await setUserStatus(token, username, enabled);
    setMessage("用户状态已更新");
    await loadUsers();
  }

  async function handleResetPassword(username: string) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    const newPassword = prompt("新密码", "") || "";
    if (!newPassword) return;
    await resetUserPassword(token, username, newPassword);
    setMessage("密码已重置");
  }

  async function handleDeleteUser(username: string) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!confirm(`确认删除用户 ${username}？`)) return;
    await deleteUser(token, username);
    setMessage("用户已删除");
    await loadUsers();
  }

  async function handleMoveUser(username: string) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    const targetOuDn = prompt("目标 OU DN", "") || "";
    if (!targetOuDn) return;
    await moveUser(token, username, targetOuDn);
    setMessage("用户已移动");
    await loadUsers();
  }

  async function handleCreateOu() {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!newOu.name || !newOu.parentDn) {
      setMessage("创建 OU 需填写名称与父 OU DN");
      return;
    }
    await createOu(token, newOu);
    setMessage("OU 创建成功");
    await loadOus();
  }

  async function handleUpdateOu(ou: Ou) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    const name = prompt("新名称(可选)", "") || "";
    const description = prompt("描述(可选)", ou.description || "") || "";
    await updateOu(token, { dn: ou.dn, name: name || undefined, description });
    setMessage("OU 已更新");
    await loadOus();
  }

  async function handleDeleteOu(ou: Ou) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!confirm(`确认删除 OU ${ou.dn}？`)) return;
    await deleteOu(token, ou.dn);
    setMessage("OU 已删除");
    await loadOus();
  }

  return (
    <div className="panel">
      <h2>管理台（简版）</h2>
      <div className="form-row">
        <span className="label">管理员 Token</span>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="actions">
        <button className={`button ${tab === "users" ? "" : "secondary"}`} onClick={() => setTab("users")}>
          用户管理
        </button>
        <button className={`button ${tab === "ous" ? "" : "secondary"}`} onClick={() => setTab("ous")}>
          OU 管理
        </button>
      </div>

      {tab === "users" && (
        <div>
          <h3>用户列表</h3>
          <div className="actions">
            <input
              className="input"
              placeholder="搜索：用户名/中文/邮箱/手机号"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input className="input" placeholder="OU DN" value={ouFilter} onChange={(e) => setOuFilter(e.target.value)} />
            <input className="input" placeholder="状态 enabled/disabled" value={status} onChange={(e) => setStatus(e.target.value)} />
            <button className="button" onClick={loadUsers}>
              查询
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>账号</th>
                <th>姓名</th>
                <th>邮箱</th>
                <th>部门</th>
                <th>岗位</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.dn}>
                  <td>{u.sAMAccountName}</td>
                  <td>{u.displayName}</td>
                  <td>{u.mail}</td>
                  <td>{u.department}</td>
                  <td>{u.title}</td>
                  <td>
                    <div className="actions">
                      <button className="button secondary" onClick={() => handleUpdateUser(u.sAMAccountName)}>
                        编辑
                      </button>
                      <button className="button secondary" onClick={() => handleToggleUser(u.sAMAccountName, true)}>
                        启用
                      </button>
                      <button className="button secondary" onClick={() => handleToggleUser(u.sAMAccountName, false)}>
                        禁用
                      </button>
                      <button className="button secondary" onClick={() => handleResetPassword(u.sAMAccountName)}>
                        重置密码
                      </button>
                      <button className="button secondary" onClick={() => handleMoveUser(u.sAMAccountName)}>
                        移动 OU
                      </button>
                      <button className="button secondary" onClick={() => handleDeleteUser(u.sAMAccountName)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>创建用户</h3>
          <div className="actions">
            <input
              className="input"
              placeholder="账号"
              value={newUser.sAMAccountName}
              onChange={(e) => setNewUser({ ...newUser, sAMAccountName: e.target.value })}
            />
            <input
              className="input"
              placeholder="姓名"
              value={newUser.displayName}
              onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
            />
            <input
              className="input"
              placeholder="OU DN"
              value={newUser.ouDn}
              onChange={(e) => setNewUser({ ...newUser, ouDn: e.target.value })}
            />
            <input
              className="input"
              placeholder="初始密码"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            <button className="button" onClick={handleCreateUser}>
              创建
            </button>
          </div>
        </div>
      )}

      {tab === "ous" && (
        <div>
          <h3>OU 列表</h3>
          <button className="button" onClick={loadOus}>
            刷新
          </button>
          <ul>
            {ous.map((ou) => (
              <li key={ou.dn}>
                {ou.dn} {ou.description ? `(${ou.description})` : ""}
                <div className="actions">
                  <button className="button secondary" onClick={() => handleUpdateOu(ou)}>
                    编辑
                  </button>
                  <button className="button secondary" onClick={() => handleDeleteOu(ou)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <h3>创建 OU</h3>
          <div className="actions">
            <input
              className="input"
              placeholder="名称"
              value={newOu.name}
              onChange={(e) => setNewOu({ ...newOu, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="父 OU DN"
              value={newOu.parentDn}
              onChange={(e) => setNewOu({ ...newOu, parentDn: e.target.value })}
            />
            <input
              className="input"
              placeholder="描述"
              value={newOu.description}
              onChange={(e) => setNewOu({ ...newOu, description: e.target.value })}
            />
            <button className="button" onClick={handleCreateOu}>
              创建
            </button>
          </div>
        </div>
      )}

      {message && <p className="notice">{message}</p>}
    </div>
  );
}
