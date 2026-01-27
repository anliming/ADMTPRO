# ADMTPRO 架构设计

## 5. 模块设计

- 认证与会话
- AD 适配层（LDAP/LDAPS）
- 用户管理
- OU 管理
- 密码管理（改密/忘记密码/重置）
- 短信服务
- 审计日志
- 配置中心
- 健康检查
- 通知与到期提醒

---

## 6. 架构分层与依赖关系

### 6.1 分层
- 表现层：前端 TypeScript SPA
- API 层：Flask REST API
- 服务层：用户/OU/密码/审计/通知
- 适配层：AD/短信/OTP
- 数据层：PostgreSQL

### 6.2 依赖关系
- 认证 → AD 适配 → 审计
- 用户/OU 管理 → AD 适配 → 审计
- 密码管理 → AD 适配 + 短信 → 审计
- 到期提醒 → AD 适配 + 通知 → 审计
- 配置中心 → 全局读取

---

## 7. 关键流程（文字版）

- 普通用户登录 → AD 认证 → 会话
- 管理员登录 → OTP → 会话
- 自助改密 → 短信验证 → AD 改密 → 审计
- 忘记密码 → 短信验证 → AD 改密 → 审计
- 管理员重置密码 → AD 重置 → 审计
- 用户/OU CRUD → AD 更新 → 审计
- 到期提醒任务 → 查询即将到期 → 通知 → 审计

---

## 8. 数据模型（逻辑层）

- User
  - dn, sAMAccountName, displayName, mail, mobile
  - department, title, enabled, ou
- OU
  - dn, name, parentDn, description
- AuditLog
  - actor, actorRole, action, targetDn
  - before/after, ip, ua, createdAt
- OTP
  - userId, secret, enabled, lastVerifiedAt
- SmsCode
  - userId, phone, code, expiresAt, status

---

## 9. API 接口清单（REST）

- 认证
  - POST /api/auth/login
  - POST /api/auth/otp/verify
  - POST /api/auth/logout
- 用户自助
  - GET /api/me
  - POST /api/me/password
  - POST /api/me/forgot-password
- 用户管理
  - GET /api/users
  - POST /api/users
  - PUT /api/users/:id
  - PATCH /api/users/:id/status
  - POST /api/users/:id/reset-password
  - DELETE /api/users/:id
- OU 管理
  - GET /api/ous
  - POST /api/ous
  - PUT /api/ous/:id
  - DELETE /api/ous/:id
  - POST /api/ous/:id/move-user
- 审计
  - GET /api/audit
  - GET /api/audit/:id
  - POST /api/audit/export
- 配置与健康
  - GET /api/config
  - PUT /api/config
  - GET /api/health

---

## 10. 权限矩阵（简版）

- 普通用户：查看自己/改密/忘记密码
- 管理员：用户/OU 管理、重置密码、审计查看
- 审计员：只读审计

---

## 11. AD 属性映射建议

- sAMAccountName / userPrincipalName / distinguishedName
- displayName, mail, mobile
- department, title
- userAccountControl（启用/禁用）

---

## 12. 字段校验（摘要）

- username：3–64
- password：8–128（遵循 AD 策略）
- otpCode / smsCode：6 位数字
- mail/mobile：格式校验
- ouDn/name：必填

---

## 13. 错误响应规范

- 通用字段：code, message, details, requestId
- 示例错误码：
  - AUTH_INVALID, AUTH_OTP_INVALID
  - PERMISSION_DENIED, AD_UNAVAILABLE
  - OBJECT_NOT_FOUND, OBJECT_CONFLICT
  - VALIDATION_ERROR, RATE_LIMITED

---

## 14. 审计字段与事件枚举

### 14.1 审计字段
- actor, actorRole, action, targetDn
- before, after, ip, ua, result, requestId, createdAt

### 14.2 事件枚举
- AUTH_LOGIN, AUTH_LOGOUT
- USER_CREATE, USER_UPDATE, USER_DISABLE, USER_ENABLE
- USER_DELETE, USER_MOVE_OU
- PASSWORD_CHANGE_SELF, PASSWORD_RESET_ADMIN
- PASSWORD_RESET_FORGOT
- OU_CREATE, OU_UPDATE, OU_DELETE
- OTP_BIND, OTP_UNBIND
- SMS_SEND, SMS_VERIFY
- PASSWORD_EXPIRY_NOTIFY

---

## 15. 安全基线

- HTTPS + HSTS
- LDAPS + 证书校验
- 管理员入口独立 + 可选 IP 白名单
- 登录失败锁定 + 限流
- CSRF 防护
- 审计日志不可篡改

---

## 16. 部署拓扑与 Docker Compose

- Nginx 反向代理 + HTTPS
- Flask API
- PostgreSQL 审计/配置/验证码
- Redis（可选）

---

## 17. 运行参数（示例）

- LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_BASE_DN, LDAP_CA_CERT
- ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET
- ALIYUN_SMS_SIGN_NAME, ALIYUN_SMS_TEMPLATE_RESET, ALIYUN_SMS_TEMPLATE_NOTIFY
- OTP_ISSUER, OTP_WINDOW
- DB_URL, AUDIT_RETENTION_DAYS
- SESSION_TTL, LOGIN_MAX_FAILS, LOGIN_LOCK_MINUTES
- SMS_CODE_TTL, SMS_SEND_INTERVAL

---

## 18. 测试与验收（摘要）

- 登录：普通/管理员/OTP
- 权限：普通用户不可管理
- 密码：改密/忘记密码/重置
- 用户/OU：CRUD 与移动
- 审计：DDL 全记录
- 到期提醒：7/3/1 天触发

---
