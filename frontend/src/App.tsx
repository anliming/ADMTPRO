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

  function pageFromPath(pathname: string): Page {
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/forgot")) return "forgot";
    if (pathname.startsWith("/me")) return "me";
    if (pathname.startsWith("/admin-console")) return "admin-console";
    if (pathname.startsWith("/audit")) return "audit";
    if (pathname.startsWith("/sms")) return "sms";
    if (pathname.startsWith("/expiry")) return "expiry";
    if (pathname.startsWith("/notifications")) return "notifications";
    if (pathname.startsWith("/config")) return "config";
    if (pathname.startsWith("/health")) return "health";
    return "login";
  }

  function pathFromPage(target: Page): string {
    switch (target) {
      case "admin":
        return "/admin";
      case "forgot":
        return "/forgot";
      case "me":
        return "/me";
      case "admin-console":
        return "/admin-console";
      case "audit":
        return "/audit";
      case "sms":
        return "/sms";
      case "expiry":
        return "/expiry";
      case "notifications":
        return "/notifications";
      case "config":
        return "/config";
      case "health":
        return "/health";
      default:
        return "/";
    }
  }

  function navigate(target: Page) {
    setPage(target);
    const nextPath = pathFromPage(target);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }

  useEffect(() => {
    getHealth()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  useEffect(() => {
    const applyRoute = () => setPage(pageFromPath(window.location.pathname));
    applyRoute();
    window.addEventListener("popstate", applyRoute);
    return () => window.removeEventListener("popstate", applyRoute);
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
          <button className={page === "login" ? "active" : ""} onClick={() => navigate("login")}>
            普通用户登录
          </button>
          <button className={page === "forgot" ? "active" : ""} onClick={() => navigate("forgot")}>
            忘记密码
          </button>
          <button className={page === "me" ? "active" : ""} onClick={() => navigate("me")}>
            个人中心
          </button>
          <button
            className={page === "admin-console" ? "active" : ""}
            onClick={() => navigate("admin-console")}
          >
            管理台
          </button>
          <button className={page === "audit" ? "active" : ""} onClick={() => navigate("audit")}>
            审计日志
          </button>
          <button className={page === "sms" ? "active" : ""} onClick={() => navigate("sms")}>
            短信日志
          </button>
          <button className={page === "expiry" ? "active" : ""} onClick={() => navigate("expiry")}>
            到期提醒
          </button>
          <button
            className={page === "notifications" ? "active" : ""}
            onClick={() => navigate("notifications")}
          >
            站内通知
          </button>
          <button className={page === "config" ? "active" : ""} onClick={() => navigate("config")}>
            配置中心
          </button>
          <button className={page === "health" ? "active" : ""} onClick={() => navigate("health")}>
            健康检查
          </button>
        </div>
      )}

      {page === "login" && <LoginPage onForgot={() => navigate("forgot")} />}
      {page === "admin" && <AdminLoginPage />}
      {page === "forgot" && <ForgotPasswordPage onBack={() => navigate("login")} />}
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
