# ADMTPRO API 接口示例

> 说明：以下示例以 `http://localhost:8088` 为入口（nginx 代理）。如直连 API，请改为 `http://localhost:8000`。
> 认证：需要管理员权限的接口，必须携带 `Authorization: Bearer <token>`。

## 健康检查

```bash
curl -s http://localhost:8088/api/health
```

```json
{"status":"ok"}
```

```bash
curl -s http://localhost:8088/api/health/details
```

```json
{"api":true,"db":true,"ldap":true}
```

## 普通用户登录

```bash
curl -s -X POST http://localhost:8088/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user1","password":"P@ssw0rd","roleHint":"user"}'
```

```json
{"token":"<jwt>","user":{"sAMAccountName":"user1","displayName":"张三","mail":"user1@domain.local","mobile":"13800000000"}}
```

## 管理员登录（OTP）

### 1) 管理员登录

```bash
curl -s -X POST http://localhost:8088/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin1","password":"P@ssw0rd","roleHint":"admin"}'
```

- 若需要 OTP：

```json
{"otp_required":true,"otp_setup_required":true,"otp_token":"<otp_token>"}
```

### 2) 绑定 OTP（首次）

```bash
curl -s -X POST http://localhost:8088/api/auth/otp/setup \
  -H 'Content-Type: application/json' \
  -d '{"otp_token":"<otp_token>"}'
```

```json
{"secret":"<secret>","otpauth_uri":"otpauth://totp/ADMTPRO:admin1?secret=...&issuer=ADMTPRO"}
```

### 3) OTP 验证

```bash
curl -s -X POST http://localhost:8088/api/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"otp_token":"<otp_token>","code":"123456"}'
```

```json
{"token":"<admin_token>"}
```

## 退出登录

```bash
curl -s -X POST http://localhost:8088/api/auth/logout
```

```json
{"status":"ok"}
```

## 获取当前用户信息

```bash
curl -s http://localhost:8088/api/me \
  -H 'Authorization: Bearer <token>'
```

```json
{"sAMAccountName":"user1","displayName":"张三","mail":"user1@domain.local","mobile":"13800000000"}
```

## 发送短信验证码（改密/忘记密码）

```bash
curl -s -X POST http://localhost:8088/api/auth/sms/send \
  -H 'Content-Type: application/json' \
  -d '{"username":"user1","scene":"forgot"}'
```

> `scene` 取值：`forgot` 或 `change`

## 忘记密码（短信）

```bash
curl -s -X POST http://localhost:8088/api/auth/forgot/reset \
  -H 'Content-Type: application/json' \
  -d '{"username":"user1","code":"123456","newPassword":"NewP@ssw0rd"}'
```

```json
{"status":"ok"}
```

## 忘记密码（邮箱）

```bash
curl -s -X POST http://localhost:8088/api/auth/email/send \
  -H 'Content-Type: application/json' \
  -d '{"username":"user1","scene":"forgot"}'
```

```bash
curl -s -X POST http://localhost:8088/api/auth/email/reset \
  -H 'Content-Type: application/json' \
  -d '{"username":"user1","code":"123456","newPassword":"NewP@ssw0rd"}'
```

## 普通用户修改密码（短信验证）

```bash
curl -s -X POST http://localhost:8088/api/me/password \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"oldPassword":"OldP@ssw0rd","newPassword":"NewP@ssw0rd","code":"123456"}'
```

```json
{"status":"ok"}
```

# 管理员接口

## 用户查询（支持用户名/中文/邮箱/手机号）

```bash
curl -s "http://localhost:8088/api/users?q=张三&ou=OU=Sales,DC=domain,DC=local&status=enabled" \
  -H 'Authorization: Bearer <admin_token>'
```

```json
{"items":[{"sAMAccountName":"user1","displayName":"张三","mail":"user1@domain.local","mobile":"13800000000","department":"销售","title":"经理","dn":"CN=张三,OU=Sales,DC=domain,DC=local"}]}
```

## 创建用户

```bash
curl -s -X POST http://localhost:8088/api/users \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"sAMAccountName":"user2","displayName":"李四","ouDn":"OU=Sales,DC=domain,DC=local","password":"P@ssw0rd","mail":"user2@domain.local","mobile":"13900000000","department":"销售","title":"专员","forceChangeAtFirstLogin":true}'
```

```json
{"status":"ok"}
```

## 更新用户信息

```bash
curl -s -X PUT http://localhost:8088/api/users/user2 \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"mail":"user2@domain.local","mobile":"13900000000","department":"销售","title":"高级专员","displayName":"李四"}'
```

```json
{"status":"ok"}
```

## 启用/禁用用户

```bash
curl -s -X PATCH http://localhost:8088/api/users/user2/status \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false}'
```

```json
{"status":"ok"}
```

## 重置用户密码

```bash
curl -s -X POST http://localhost:8088/api/users/user2/reset-password \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"newPassword":"NewP@ssw0rd","forceChangeAtFirstLogin":true}'
```

```json
{"status":"ok"}
```

## 移动用户到 OU

```bash
curl -s -X POST http://localhost:8088/api/users/user2/move \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"targetOuDn":"OU=IT,DC=domain,DC=local"}'
```

```json
{"status":"ok"}
```

## 删除用户

```bash
curl -s -X DELETE http://localhost:8088/api/users/user2 \
  -H 'Authorization: Bearer <admin_token>'
```

```json
{"status":"ok"}
```

## 批量操作用户

```bash
curl -s -X POST http://localhost:8088/api/users/batch \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"action":"disable","usernames":["user1","user2"]}'
```

```json
{"count":2}
```

## 导出用户 CSV

```bash
curl -s "http://localhost:8088/api/users/export?q=&ou=&status=" \
  -H 'Authorization: Bearer <admin_token>'
```

## 导入用户 CSV

```bash
curl -s -X POST http://localhost:8088/api/users/import \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"csv":"sAMAccountName,displayName,ouDn,password,mail,mobile,department,title,forceChangeAtFirstLogin\nuser3,王五,OU=IT,DC=domain,DC=local,P@ssw0rd,user3@domain.local,13700000000,IT,工程师,true"}'
```

```json
{"created":1,"errors":[]}
```

## OU 列表

```bash
curl -s http://localhost:8088/api/ous \
  -H 'Authorization: Bearer <admin_token>'
```

```json
{"items":[{"dn":"OU=Sales,DC=domain,DC=local","name":"Sales","description":"销售部"}]}
```

## 创建 OU

```bash
curl -s -X POST http://localhost:8088/api/ous \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"R&D","parentDn":"DC=domain,DC=local","description":"研发部"}'
```

```json
{"status":"ok"}
```

## 更新 OU

```bash
curl -s -X PUT http://localhost:8088/api/ous \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"dn":"OU=R&D,DC=domain,DC=local","name":"研发中心","description":"研发中心"}'
```

```json
{"status":"ok"}
```

## 删除 OU

```bash
curl -s -X DELETE http://localhost:8088/api/ous \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"dn":"OU=R&D,DC=domain,DC=local"}'
```

```json
{"status":"ok"}
```

## 审计日志查询

```bash
curl -s "http://localhost:8088/api/audit?actor=admin1&action=USER_CREATE&result=ok&limit=50" \
  -H 'Authorization: Bearer <admin_token>'
```

```json
{"items":[{"id":1,"actor":"admin1","actor_role":"admin","action":"USER_CREATE","target":"user2","result":"ok","detail":"","created_at":"2026-01-27T10:00:00"}]}
```

## 审计日志导出

```bash
curl -s "http://localhost:8088/api/audit/export?limit=1000" \
  -H 'Authorization: Bearer <admin_token>'
```

## 短信日志查询

```bash
curl -s "http://localhost:8088/api/sms/list?username=user1&scene=forgot&status=sent&limit=50" \
  -H 'Authorization: Bearer <admin_token>'
```

## 短信重试

```bash
curl -s -X POST http://localhost:8088/api/sms/retry \
  -H 'Authorization: Bearer <admin_token>'
```

```json
{"status":"ok","retried":2,"errors":[]}
```

## 密码到期提醒

```bash
curl -s http://localhost:8088/api/password-expiry/list?username=user1&status=sent&limit=50 \
  -H 'Authorization: Bearer <admin_token>'
```

```bash
curl -s -X POST http://localhost:8088/api/password-expiry/trigger \
  -H 'Authorization: Bearer <admin_token>'
```

```json
{"status":"ok"}
```

## 配置中心

```bash
curl -s http://localhost:8088/api/config \
  -H 'Authorization: Bearer <admin_token>'
```

```bash
curl -s -X PUT http://localhost:8088/api/config \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"key":"PASSWORD_EXPIRY_ENABLE","value":true}'
```

```bash
curl -s http://localhost:8088/api/config/history?limit=50 \
  -H 'Authorization: Bearer <admin_token>'
```

```bash
curl -s -X POST http://localhost:8088/api/config/rollback \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"id":12}'
```

## 站内通知（普通用户）

```bash
curl -s http://localhost:8088/api/notifications \
  -H 'Authorization: Bearer <token>'
```

```json
{"items":[{"id":1,"username":"user1","days_left":3,"status":"sent","notify_date":"2026-01-27"}]}
```
