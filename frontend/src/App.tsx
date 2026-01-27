import { useEffect, useState } from "react";
import { getHealth } from "./services/api";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import MePage from "./pages/MePage";
import AdminConsolePage from "./pages/AdminConsolePage";
import AuditLogPage from "./pages/AuditLogPage";
import SmsLogPage from "./pages/SmsLogPage";
import PasswordExpiryPage from "./pages/PasswordExpiryPage";
import NotificationsPage from "./pages/NotificationsPage";
import ConfigPage from "./pages/ConfigPage";
import HealthPage from "./pages/HealthPage";
import { useToken } from "./store";

type Page =
  | "login"
  | "admin"
  | "forgot"
  | "me"
  | "admin-console"
  | "audit"
  | "sms"
  | "expiry"
  | "notifications"
  | "config"
  | "health";

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [health, setHealth] = useState<string>("checking");
  const { token, setToken } = useToken();

  useEffect(() => {
    getHealth()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <div className="app">
      <div className="header">
        <div className="brand">ADMTPRO</div>
        <div className="status">
          API 健康检查：{health}{" "}
          {token ? (
            <button
              className="button secondary"
              onClick={() => {
                if (confirm("确认退出登录？")) {
                  setToken("");
                }
              }}
            >
              退出登录
            </button>
          ) : (
            <span className="badge">未登录</span>
          )}
        </div>
      </div>

      {page !== "login" && page !== "forgot" && (
        <div className="nav">
          <button className={page === "login" ? "active" : ""} onClick={() => setPage("login")}>
            普通用户登录
          </button>
          <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>
            管理员登录
          </button>
          <button className={page === "forgot" ? "active" : ""} onClick={() => setPage("forgot")}>
            忘记密码
          </button>
          <button className={page === "me" ? "active" : ""} onClick={() => setPage("me")}>
            个人中心
          </button>
          <button
            className={page === "admin-console" ? "active" : ""}
            onClick={() => setPage("admin-console")}
          >
            管理台
          </button>
          <button className={page === "audit" ? "active" : ""} onClick={() => setPage("audit")}>
            审计日志
          </button>
          <button className={page === "sms" ? "active" : ""} onClick={() => setPage("sms")}>
            短信日志
          </button>
          <button className={page === "expiry" ? "active" : ""} onClick={() => setPage("expiry")}>
            到期提醒
          </button>
          <button
            className={page === "notifications" ? "active" : ""}
            onClick={() => setPage("notifications")}
          >
            站内通知
          </button>
          <button className={page === "config" ? "active" : ""} onClick={() => setPage("config")}>
            配置中心
          </button>
          <button className={page === "health" ? "active" : ""} onClick={() => setPage("health")}>
            健康检查
          </button>
        </div>
      )}

      {page === "login" && <LoginPage onForgot={() => setPage("forgot")} />}
      {page === "admin" && <AdminLoginPage />}
      {page === "forgot" && <ForgotPasswordPage onBack={() => setPage("login")} />}
      {page === "me" && <MePage />}
      {page === "admin-console" && <AdminConsolePage />}
      {page === "audit" && <AuditLogPage />}
      {page === "sms" && <SmsLogPage />}
      {page === "expiry" && <PasswordExpiryPage />}
      {page === "notifications" && <NotificationsPage />}
      {page === "config" && <ConfigPage />}
      {page === "health" && <HealthPage />}
    </div>
  );
}
