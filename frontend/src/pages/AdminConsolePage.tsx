import { useEffect, useMemo, useState } from "react";
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
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";

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
  const toast = useToast();
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
  const [selectedOu, setSelectedOu] = useState<Ou | null>(null);
  const [ouEditOpen, setOuEditOpen] = useState(false);
  const [ouDeleteOpen, setOuDeleteOpen] = useState(false);
  const [ouForm, setOuForm] = useState({ name: "", description: "" });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    mail: "",
    mobile: "",
    department: "",
    title: ""
  });
  const [resetPassword, setResetPassword] = useState("");
  const [moveTargetOu, setMoveTargetOu] = useState("");

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
    toast.push("用户创建成功", "success");
    await loadUsers();
  }

  function openEdit(user: User) {
    setSelectedUser(user);
    setEditForm({
      displayName: user.displayName || "",
      mail: user.mail || "",
      mobile: user.mobile || "",
      department: user.department || "",
      title: user.title || ""
    });
    setEditOpen(true);
  }

  async function handleToggleUser(username: string, enabled: boolean) {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    const user = users.find((u) => u.sAMAccountName === username) || null;
    setSelectedUser(user);
    if (enabled) {
      await setUserStatus(token, username, true);
      toast.push("用户已启用", "success");
      await loadUsers();
      return;
    }
    setDisableOpen(true);
  }

  function openReset(user: User) {
    setSelectedUser(user);
    setResetPassword("");
    setResetOpen(true);
  }

  async function handleResetPassword() {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!selectedUser) return;
    if (!resetPassword) {
      setMessage("请输入新密码");
      return;
    }
    await resetUserPassword(token, selectedUser.sAMAccountName, resetPassword);
    toast.push("密码已重置", "success");
    setResetOpen(false);
  }

  function openDelete(user: User) {
    setSelectedUser(user);
    setDeleteOpen(true);
  }

  async function handleDeleteUser() {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!selectedUser) return;
    await deleteUser(token, selectedUser.sAMAccountName);
    toast.push("用户已删除", "success");
    setDeleteOpen(false);
    await loadUsers();
  }

  function openMove(user: User) {
    setSelectedUser(user);
    setMoveTargetOu("");
    setMoveOpen(true);
  }

  async function handleMoveUser() {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!selectedUser) return;
    if (!moveTargetOu) {
      setMessage("请选择目标 OU");
      return;
    }
    await moveUser(token, selectedUser.sAMAccountName, moveTargetOu);
    toast.push("用户已移动", "success");
    setMoveOpen(false);
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
    toast.push("OU 创建成功", "success");
    await loadOus();
  }

  function openOuEdit(ou: Ou) {
    setSelectedOu(ou);
    setOuForm({ name: "", description: ou.description || "" });
    setOuEditOpen(true);
  }

  async function handleUpdateOu() {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!selectedOu) return;
    await updateOu(token, { dn: selectedOu.dn, name: ouForm.name || undefined, description: ouForm.description });
    toast.push("OU 已更新", "success");
    setOuEditOpen(false);
    await loadOus();
  }

  function openOuDelete(ou: Ou) {
    setSelectedOu(ou);
    setOuDeleteOpen(true);
  }

  async function handleDeleteOu() {
    if (!token.trim()) {
      setMessage("请输入管理员 Token");
      return;
    }
    if (!selectedOu) return;
    await deleteOu(token, selectedOu.dn);
    toast.push("OU 已删除", "success");
    setOuDeleteOpen(false);
    await loadOus();
  }

  const ouOptions = useMemo(() => {
    const items = [...ous];
    items.sort((a, b) => (a.dn || "").localeCompare(b.dn || ""));
    return items.map((o) => {
      const depth = (o.dn.match(/OU=/g) || []).length;
      return { dn: o.dn, label: `${"— ".repeat(depth)}${o.dn}` };
    });
  }, [ous]);

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
          <div className="split">
            <div>
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
                <tr key={u.dn} onClick={() => setSelectedUser(u)}>
                  <td>{u.sAMAccountName}</td>
                  <td>{u.displayName}</td>
                  <td>{u.mail}</td>
                  <td>{u.department}</td>
                  <td>{u.title}</td>
                  <td>
                    <div className="actions">
                      <button className="button secondary" onClick={() => openEdit(u)}>
                        编辑
                      </button>
                      <button className="button secondary" onClick={() => handleToggleUser(u.sAMAccountName, true)}>
                        启用
                      </button>
                      <button className="button secondary" onClick={() => handleToggleUser(u.sAMAccountName, false)}>
                        禁用
                      </button>
                      <button className="button secondary" onClick={() => openReset(u)}>
                        重置密码
                      </button>
                      <button className="button secondary" onClick={() => openMove(u)}>
                        移动 OU
                      </button>
                      <button className="button secondary" onClick={() => openDelete(u)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
              </table>
            </div>
            <div className="side-panel">
              <h3>用户详情</h3>
              {selectedUser ? (
                <div className="form">
                  <div className="form-row">
                    <span className="label">账号</span>
                    <div>{selectedUser.sAMAccountName}</div>
                  </div>
                  <div className="form-row">
                    <span className="label">姓名</span>
                    <div>{selectedUser.displayName}</div>
                  </div>
                  <div className="form-row">
                    <span className="label">邮箱</span>
                    <div>{selectedUser.mail}</div>
                  </div>
                  <div className="form-row">
                    <span className="label">部门</span>
                    <div>{selectedUser.department}</div>
                  </div>
                  <div className="form-row">
                    <span className="label">岗位</span>
                    <div>{selectedUser.title}</div>
                  </div>
                </div>
              ) : (
                <p className="notice">请选择一个用户</p>
              )}
            </div>
          </div>

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
                {`${"— ".repeat((ou.dn.match(/OU=/g) || []).length)}${ou.dn}`}{" "}
                {ou.description ? `(${ou.description})` : ""}
                <div className="actions">
                  <button className="button secondary" onClick={() => openOuEdit(ou)}>
                    编辑
                  </button>
                  <button className="button secondary" onClick={() => openOuDelete(ou)}>
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

      <Modal title="编辑用户" open={editOpen} onClose={() => setEditOpen(false)}>
        <div className="form-row">
          <span className="label">姓名</span>
          <input
            className="input"
            value={editForm.displayName}
            onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
          />
        </div>
        <div className="form-row">
          <span className="label">邮箱</span>
          <input
            className="input"
            value={editForm.mail}
            onChange={(e) => setEditForm({ ...editForm, mail: e.target.value })}
          />
        </div>
        <div className="form-row">
          <span className="label">手机号</span>
          <input
            className="input"
            value={editForm.mobile}
            onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
          />
        </div>
        <div className="form-row">
          <span className="label">部门</span>
          <input
            className="input"
            value={editForm.department}
            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
          />
        </div>
        <div className="form-row">
          <span className="label">岗位</span>
          <input
            className="input"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          />
        </div>
        <div className="actions">
          <button
            className="button"
            onClick={async () => {
              if (!selectedUser) return;
              await updateUser(token, selectedUser.sAMAccountName, editForm);
              toast.push("用户已更新", "success");
              setEditOpen(false);
              await loadUsers();
            }}
          >
            保存
          </button>
        </div>
      </Modal>

      <Modal title="重置密码" open={resetOpen} onClose={() => setResetOpen(false)}>
        <div className="form-row">
          <span className="label">新密码</span>
          <input
            className="input"
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
        </div>
        <div className="actions">
          <button className="button" onClick={handleResetPassword}>
            确认重置
          </button>
        </div>
      </Modal>

      <Modal title="移动 OU" open={moveOpen} onClose={() => setMoveOpen(false)}>
        <div className="form-row">
          <span className="label">目标 OU</span>
          <select className="input" value={moveTargetOu} onChange={(e) => setMoveTargetOu(e.target.value)}>
            <option value="">请选择</option>
            {ouOptions.map((o) => (
              <option key={o.dn} value={o.dn}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="actions">
          <button className="button" onClick={handleMoveUser}>
            确认移动
          </button>
        </div>
      </Modal>

      <Modal title="删除用户" open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <p>确认删除用户 {selectedUser?.sAMAccountName}？</p>
        <div className="actions">
          <button className="button" onClick={handleDeleteUser}>
            确认删除
          </button>
        </div>
      </Modal>

      <Modal title="禁用用户" open={disableOpen} onClose={() => setDisableOpen(false)}>
        <p>确认禁用用户 {selectedUser?.sAMAccountName}？</p>
        <div className="actions">
          <button
            className="button"
            onClick={async () => {
              if (!selectedUser) return;
              await setUserStatus(token, selectedUser.sAMAccountName, false);
              toast.push("用户已禁用", "success");
              setDisableOpen(false);
              await loadUsers();
            }}
          >
            确认禁用
          </button>
        </div>
      </Modal>

      <Modal title="编辑 OU" open={ouEditOpen} onClose={() => setOuEditOpen(false)}>
        <div className="form-row">
          <span className="label">新名称（可选）</span>
          <input
            className="input"
            value={ouForm.name}
            onChange={(e) => setOuForm({ ...ouForm, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <span className="label">描述</span>
          <input
            className="input"
            value={ouForm.description}
            onChange={(e) => setOuForm({ ...ouForm, description: e.target.value })}
          />
        </div>
        <div className="actions">
          <button className="button" onClick={handleUpdateOu}>
            保存
          </button>
        </div>
      </Modal>

      <Modal title="删除 OU" open={ouDeleteOpen} onClose={() => setOuDeleteOpen(false)}>
        <p>确认删除 OU {selectedOu?.dn}？</p>
        <div className="actions">
          <button className="button" onClick={handleDeleteOu}>
            确认删除
          </button>
        </div>
      </Modal>
    </div>
  );
}
