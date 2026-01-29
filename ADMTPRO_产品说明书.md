# ADMTPRO 产品说明书

## 1. 产品概述
ADMTPRO 是一套面向 AD 域控的管理平台，提供用户、OU、权限、密码、安全验证、审计与系统配置等能力。系统采用 BS 架构，前后端分离、单体部署，支持 Docker Compose 快速落地。

## 2. 功能介绍
### 2.1 权限与登录
- 普通用户登录：仅可查看并维护自己的基础信息（姓名/邮箱/手机号），可修改自身密码。
- 管理员登录：独立入口 `/admin`，可进行用户/OU/配置/审计/健康管理。
- 管理员登录带 OTP 二次验证；仅具备管理员权限的用户才进入 OTP 流程。

### 2.2 用户管理
- 用户列表与查询：支持分页、筛选 OU、状态筛选。
- 用户创建/编辑/删除/启用/禁用。
- 支持用户移动至其他 OU。
- 支持导出/批量导入。
- 默认隐藏“禁用用户”，查询时可检索到。
- 默认隐藏“手机号为空”的用户，查询时可检索到。

### 2.3 OU 管理
- OU 新增/编辑/删除。
- OU 层级展示与展开，点击末级 OU 可查看该 OU 下用户（分页）。

### 2.4 密码与重置
- 普通用户可修改自身密码（含短信验证码）。
- 管理员可重置用户密码。
- 忘记密码：短信认证后重置。
- 密码到期提醒与到期日期展示。

### 2.5 二次验证
- 管理员使用 OTP 登录验证（支持首次绑定）。

### 2.6 系统配置
- 系统名称、Logo、版权、页脚、联系方式等可配置并前端展示。
- 可配置是否启用页脚等展示选项。

### 2.7 日志审计
- 重要 DDL 操作均记录审计日志。

### 2.8 健康检查
- API、数据库、LDAP 连接状态监测。

## 3. 配置与使用
### 3.1 环境要求
- Docker + Docker Compose
- Python 3.12（容器内）
- PostgreSQL（容器内）

### 3.2 主要配置项
配置路径：`.env` 或 `docker-compose.yml` 中的环境变量

#### LDAP/AD
- `LDAP_URL`：LDAP/LDAPS 地址
- `LDAP_BIND_DN`：服务账号 DN
- `LDAP_BIND_PASSWORD`：服务账号密码
- `LDAP_BASE_DN`：域根 DN
- `LDAP_CA_CERT`：CA 证书路径
- `LDAP_TLS_VERIFY`：是否校验证书
- `LDAP_TLS_ALLOW_WEAK`：允许弱证书（测试环境）
- `LDAP_ADMIN_GROUP_DN`：管理员组 DN（判定管理员权限）

#### 数据库
- `DB_URL`：PostgreSQL 连接串

#### OTP
- `OTP_ISSUER`：OTP 发行者名称
- `OTP_TOKEN_TTL`：OTP 临时令牌有效期（秒）

#### 短信
- `SMS_PROVIDER=aliyun`
- `ALIYUN_SMS_ACCESS_KEY`
- `ALIYUN_SMS_ACCESS_SECRET`
- `ALIYUN_SMS_SIGN_NAME`
- `ALIYUN_SMS_TEMPLATE_CODE`
- `SMS_RATE_LIMIT_MINUTES`：短信频率限制（分钟）

#### 邮件
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_SSL`：使用 SSL（465）
- `SMTP_TLS`：使用 STARTTLS（587）
- `EMAIL_RESET_SUBJECT`：邮件验证码主题（支持 {username}/{code}/{ttl}）
- `EMAIL_RESET_TEMPLATE`：邮件验证码正文（支持 {username}/{code}/{ttl}）

#### 系统配置
- `APP_NAME`
- `APP_LOGO_URL`
- `APP_COPYRIGHT`
- `APP_FOOTER_TEXT`
- `APP_SUPPORT_EMAIL`
- `APP_SUPPORT_PHONE`
- `APP_SHOW_FOOTER`
- `APP_THEME_BG`
- `APP_ALERT_BG`
- `APP_BROWSER_TITLE`：浏览器标题
- `SESSION_TTL`：登录会话有效期（秒）

### 3.3 启动方式
```bash
# 启动
docker compose up -d

# 查看日志
docker compose logs -f
```

### 3.4 访问入口
- 普通用户登录：`/`
- 管理员登录：`/admin`

### 3.5 配置示例（片段）
```ini
# LDAP
LDAP_URL=ldaps://dc.example.com:636
LDAP_BIND_DN=CN=svc_adm,OU=Service,DC=example,DC=com
LDAP_BIND_PASSWORD=your-password
LDAP_BASE_DN=DC=example,DC=com
LDAP_CA_CERT=/app/certs/ad-ca.crt
LDAP_TLS_VERIFY=true
LDAP_TLS_ALLOW_WEAK=false
LDAP_ADMIN_GROUP_DN=CN=ADMTPRO-Admins,OU=Groups,DC=example,DC=com

# DB
DB_URL=postgresql://admtpro:admtpro@db:5432/admtpro

# OTP
OTP_ISSUER=ADMTPRO
OTP_TOKEN_TTL=300

# SMS (Aliyun)
SMS_PROVIDER=aliyun
ALIYUN_SMS_ACCESS_KEY=xxx
ALIYUN_SMS_ACCESS_SECRET=xxx
ALIYUN_SMS_SIGN_NAME=企业短信
ALIYUN_SMS_TEMPLATE_CODE=SMS_00000000
SMS_RATE_LIMIT_MINUTES=1

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASSWORD=xxx
SMTP_FROM=ADMTPRO <no-reply@example.com>
SMTP_SSL=false
SMTP_TLS=true

# UI
APP_NAME=ADMTPRO
APP_BROWSER_TITLE=ADMTPRO 管理台
APP_LOGO_URL=/assets/logo.svg
APP_COPYRIGHT=© 2026 示例企业
APP_FOOTER_TEXT=技术支持：IT 服务台
APP_SUPPORT_EMAIL=support@example.com
APP_SUPPORT_PHONE=400-000-0000
APP_SHOW_FOOTER=true
APP_THEME_BG=#f7f2ea
APP_ALERT_BG=#f0e9de
```

### 3.6 关键业务字段说明
- `displayName`：显示名称/姓名。
- `mail`：邮箱地址。
- `mobile`：手机号。
- `department`：部门名称（用于检索与展示）。
- `title`：岗位/职级。
- `accountExpires`：账户到期时间（AD filetime）；前端以 `account_expiry_date` 显示。
- `msDS-UserPasswordExpiryTimeComputed`：密码到期时间（AD 计算值）；前端以 `password_expiry_date` 显示。
- `userAccountControl`：账号状态标识；禁用时为 `0x2`。

### 3.7 管理员权限判定
- 通过 `LDAP_ADMIN_GROUP_DN` 指定管理员组 DN。
- 管理员登录：用户名密码正确后判定是否属于管理员组；否则拒绝进入 OTP 流程。

### 3.8 短信与 OTP 行为说明
- 忘记密码/修改密码均需短信验证码。
- 管理员首次登录若未绑定 OTP，进入绑定流程并生成 OTP URI。
- OTP URI 建议与企业品牌保持一致（issuer/name 可配置）。

### 3.9 接口清单（摘要）
#### 认证与会话
- `POST /api/auth/login`：普通用户登录
- `POST /api/auth/admin/login`：管理员登录（返回 OTP 要求）
- `POST /api/auth/otp/setup`：获取 OTP 绑定信息
- `POST /api/auth/otp/verify`：OTP 验证登录
- `POST /api/auth/logout`：退出登录/清空令牌

#### 用户
- `GET /api/me`：当前用户信息
- `POST /api/me/password`：用户改密（短信验证码）
- `GET /api/users`：用户列表（分页/筛选/搜索）
- `POST /api/users`：创建用户
- `PUT /api/users/{username}`：编辑用户
- `DELETE /api/users/{username}`：删除用户
- `PATCH /api/users/{username}/status`：启用/禁用
- `POST /api/users/{username}/move`：移动 OU
- `POST /api/users/{username}/reset-password`：管理员重置密码
- `GET /api/users/export`：导出用户
- `POST /api/users/import`：批量导入

#### OU
- `GET /api/ous`：OU 列表
- `POST /api/ous`：创建 OU
- `PUT /api/ous`：编辑 OU
- `DELETE /api/ous`：删除 OU

#### 密码到期与通知
- `GET /api/password-expiry/list`：到期提醒记录
- `POST /api/password-expiry/trigger`：触发到期检查

#### 审计/配置/健康
- `GET /api/audit`：审计日志
- `GET /api/config`：配置读取
- `POST /api/config`：配置更新
- `GET /api/health`：健康检查

### 3.10 接口字段示例（摘要）
#### 登录响应（管理员）
```json
{
  "otp_required": true,
  "otp_setup_required": false,
  "otp_token": "jwt-token"
}
```

#### 用户列表项
```json
{
  "sAMAccountName": "zhangsan",
  "displayName": "张三",
  "mail": "zhangsan@example.com",
  "mobile": "13800000000",
  "department": "技术部",
  "title": "工程师",
  "dn": "CN=张三,OU=技术部,DC=example,DC=com",
  "enabled": true,
  "days_left": 12,
  "password_expiry_date": "2026-02-10",
  "account_expiry_date": "2026-12-31"
}
```

### 3.11 典型接口请求/响应示例
#### 普通用户登录
请求
```http
POST /api/auth/login
Content-Type: application/json
```
```json
{
  "username": "user1",
  "password": "P@ssw0rd"
}
```
响应
```json
{
  "token": "jwt-token",
  "role": "user"
}
```

#### 管理员登录（OTP 流程）
请求
```http
POST /api/auth/admin/login
```
```json
{
  "username": "admin1",
  "password": "P@ssw0rd"
}
```
响应
```json
{
  "otp_required": true,
  "otp_setup_required": true,
  "otp_token": "otp-jwt"
}
```

#### OTP 绑定
请求
```http
POST /api/auth/otp/setup
Authorization: Bearer otp-jwt
```
响应
```json
{
  "secret": "BASE32SECRET",
  "otpauth_uri": "otpauth://totp/ADMTPRO:admin1?secret=BASE32SECRET&issuer=ADMTPRO"
}
```

#### OTP 验证登录
请求
```http
POST /api/auth/otp/verify
Authorization: Bearer otp-jwt
```
```json
{
  "code": "123456"
}
```
响应
```json
{
  "token": "jwt-token",
  "role": "admin"
}
```

#### 用户列表
请求
```http
GET /api/users?page=1&pageSize=15&ou=OU%3DTech%2CDC%3Dexample%2CDC%3Dcom
Authorization: Bearer jwt-token
```
响应
```json
{
  "items": [
    {
      "sAMAccountName": "zhangsan",
      "displayName": "张三",
      "mail": "zhangsan@example.com",
      "mobile": "13800000000",
      "department": "技术部",
      "title": "工程师",
      "dn": "CN=张三,OU=技术部,DC=example,DC=com",
      "enabled": true
    }
  ],
  "total": 120,
  "page": 1,
  "pageSize": 15
}
```

#### 修改用户信息
请求
```http
PUT /api/users/zhangsan
Authorization: Bearer jwt-token
```
```json
{
  "displayName": "张三",
  "mail": "zhangsan@example.com",
  "mobile": "13800000000",
  "department": "技术部",
  "title": "高级工程师",
  "accountExpiryDate": "2026-12-31"
}
```
响应
```json
{
  "status": "ok"
}
```

### 3.12 接口错误码表（摘要）
- `AUTH_REQUIRED`：未登录或令牌失效
- `AUTH_INVALID`：验证码无效或已过期
- `PERMISSION_DENIED`：无权限执行该操作
- `VALIDATION_ERROR`：参数校验失败
- `OBJECT_NOT_FOUND`：对象不存在
- `AD_ERROR`：AD/LDAP 操作失败
- `AD_POLICY_VIOLATION`：密码策略不符合要求
- `OTP_REQUIRED`：需要 OTP 验证
- `OTP_SETUP_REQUIRED`：需要先绑定 OTP


#### 忘记密码
请求
```http
POST /api/auth/forgot-password
```
```json
{
  "username": "user1",
  "code": "123456",
  "newPassword": "NewP@ssw0rd"
}
```
响应
```json
{
  "status": "ok"
}
```

## 4. 运维说明
### 4.0 部署拓扑与端口
- `nginx`：对外入口，默认 `8088`（静态资源 + 反向代理 `/api`）
- `api`：后端服务，内部端口 `8000`
- `db`：PostgreSQL，内部端口 `5432`

示意拓扑：
```
Browser -> Nginx(8088) -> / (frontend static)
                        -> /api/* (proxy) -> API(8000) -> DB(5432)
                                               |
                                               -> LDAP/AD (389/636)
```

### 4.1 运维监控指标清单（建议）
- 业务可用性：API 健康检查（HTTP 200）成功率
- LDAP 连接：bind 成功率/延迟、证书有效期
- 数据库：连接数、慢查询、磁盘空间
- 短信发送：成功率、失败原因、发送频率
- OTP：验证失败率
- 审计日志写入：写入失败次数

### 4.1.1 告警阈值建议（可按实际调整）
- API 健康检查失败率 > 1%（5 分钟窗口）告警
- LDAP bind 失败率 > 2% 或平均延迟 > 500ms 告警
- DB 连接数 > 80% 或磁盘剩余 < 15% 告警
- 短信发送失败率 > 5% 告警
- OTP 验证失败率 > 10% 告警
- 审计日志写入失败出现即告警

### 4.2 日志
- API 容器日志：`docker compose logs -f api`
- Web/Nginx 日志：`docker compose logs -f nginx`

### 4.3 常见运维检查
- LDAP 连通性、证书校验
- API 健康检查接口
- 数据库连接与磁盘空间
- 前端静态资源是否更新（Nginx 是否加载最新构建）

### 4.4 备份建议
- PostgreSQL 定期备份（schema + data）
- `.env` 与证书文件备份
```bash
# 备份示例
docker exec -t admtpro-db pg_dump -U admtpro -F c -b -f /backup/admtpro.dump admtpro
```

### 4.5 恢复建议
```bash
docker exec -i admtpro-db pg_restore -U admtpro -d admtpro /backup/admtpro.dump
```

### 4.6 升级建议
- 新版本部署前：数据库备份
- 版本升级后：执行一次健康检查与登录测试
- 建议在测试环境先验证 LDAP/短信/OTP 流程

## 5. 故障排查
- LDAP 证书错误：检查 CA 证书路径、权限与 LDAP_TLS 配置。
- 账号无法登录：确认账号状态、密码策略、管理员权限组配置。
- 前端空白：检查 API 是否返回 401/500，前端请求路径是否正确。
- OTP 绑定失败：确认管理员权限组配置及 OTP issuer 配置。
- 短信发送失败：检查阿里云配置、短信签名/模板、发送频率限制。
