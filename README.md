# ADMTPRO

AD 域控管理工具（BS 架构，前后端分离），支持普通用户自助与管理员运维。

## 功能

- 普通用户登录、查看自身信息（姓名/邮箱/手机号）
- 自助改密（旧密码 + 短信验证码）
- 忘记密码（短信验证码）
- 管理员登录 + OTP 二次验证
- 用户管理：增删改查/启用/禁用/重置密码/移动 OU
- OU 管理：增删改查
- 审计日志（DDL 全覆盖）
- 短信发送日志与失败重试（手动/自动）
- 密码到期提醒（短信通知）
- 站内通知（展示到期提醒记录）
- 配置中心（短信/LDAP/OTP/提醒阈值）

## 技术栈

- 后端：Python 3.12 + Flask
- 前端：TypeScript + React + Vite
- 部署：Docker Compose
- 依赖：LDAP/LDAPS、PostgreSQL、Redis（可选）

## 目录结构

- `backend/` 后端服务
- `frontend/` 前端页面
- `deploy/` Nginx 配置
- `docker-compose.yml` 本地部署编排

## 快速开始

1) 复制环境变量

```
cp .env.example .env
```

2) 补齐 `.env` 中的 LDAP/短信/DB 配置

3) 启动

```
docker compose up --build
```

4) 访问

- 前端：`http://localhost:5173`
- API：`http://localhost:8000/api/health`

## 关键环境变量

- LDAP
  - `LDAP_URL` / `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` / `LDAP_BASE_DN` / `LDAP_CA_CERT`
- 管理员组
  - `ADMIN_GROUP_DN`
- 短信（阿里云）
  - `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`
  - `ALIYUN_SMS_SIGN_NAME`
  - `ALIYUN_SMS_TEMPLATE_RESET`
  - `ALIYUN_SMS_TEMPLATE_NOTIFY`（到期提醒模板，参数 `{days}`）
- OTP
  - `OTP_ISSUER` / `OTP_WINDOW`
- 短信重试
  - `SMS_AUTO_RETRY` / `SMS_RETRY_INTERVAL`
- 密码到期提醒
  - `PASSWORD_EXPIRY_ENABLE`
  - `PASSWORD_EXPIRY_DAYS`（如 `7,3,1`）
  - `PASSWORD_EXPIRY_CHECK_INTERVAL`

## 说明

- 密码到期提醒使用 AD 属性 `msDS-UserPasswordExpiryTimeComputed`。
- 忘记密码与自助改密均通过短信验证码校验。
- 审计日志记录所有用户/OU 相关 DDL 操作。
- 用户搜索支持：账号/中文姓名/邮箱/手机号（若拼音存于 `displayName/cn` 亦可匹配）。
- 登录失败达到阈值会触发账号锁定（可配置）。

## 主要接口（摘要）

- 认证
  - `POST /api/auth/login`
  - `POST /api/auth/otp/setup`
  - `POST /api/auth/otp/verify`
- 用户自助
  - `GET /api/me`
  - `POST /api/me/password`
  - `POST /api/auth/forgot/reset`
- 短信
  - `POST /api/auth/sms/send`
  - `POST /api/sms/retry`
  - `GET /api/sms/list`
- 密码到期提醒
  - `GET /api/password-expiry/list`
  - `POST /api/password-expiry/trigger`
- 站内通知
  - `GET /api/notifications`
- 配置中心
  - `GET /api/config`
  - `PUT /api/config`
  - 保存后会覆盖运行时配置，并可在开启时自动启动短信重试/到期提醒后台任务
- 用户/OU 管理
  - `GET /api/users` / `POST /api/users` / `PUT /api/users/:username`
  - `PATCH /api/users/:username/status` / `POST /api/users/:username/reset-password`
  - `DELETE /api/users/:username` / `POST /api/users/:username/move`
  - `GET /api/ous` / `POST /api/ous` / `PUT /api/ous` / `DELETE /api/ous`
- 审计
  - `GET /api/audit`

## 开发说明

- 开发模式下短信接口会返回 `dev_code` 便于联调。
- 生产环境请确保短信模板与签名已审核通过。
