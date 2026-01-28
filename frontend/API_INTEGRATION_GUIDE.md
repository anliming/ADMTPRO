# ADMTPRO API 集成指南

## 已完成的工作

### ✅ 核心基础设施
1. **API 客户端** (`/src/app/utils/api.ts`)
   - 完整的 API 封装
   - 自动 Token 管理
   - 所有后端接口的类型定义和方法

2. **认证上下文** (`/src/app/contexts/AuthContext.tsx`)
   - 用户状态管理
   - 登录/登出逻辑
   - OTP 验证流程

3. **登录流程** 
   - ✅ 普通用户登录 (`LoginPage.tsx`)
   - ✅ 管理员登录 + OTP (`AdminLoginPage.tsx`)
   - ✅ 忘记密码流程 (`ForgotPassword.tsx`)

4. **配置文件**
   - `.env.example` - API 地址配置示例

## 待更新的组件

以下组件需要从模拟数据切换到真实 API 调用：

### 1. UserDashboard.tsx (用户个人中心)

**需要更新的功能：**
- 加载用户信息：使用 `useAuth().user`
- 修改密码：调用 `authApi.changePassword()`
- 获取通知：调用 `notificationApi.list()`

**数据映射：**
```typescript
// 后端字段 -> 显示
sAMAccountName -> 用户名
displayName -> 姓名
mail -> 邮箱
mobile -> 手机号
department -> 部门
title -> 岗位
```

### 2. Admin/UserManagement.tsx (用户管理)

**需要更新的API调用：**
```typescript
// 查询用户
const { items } = await userApi.list({ q, ou, status });

// 创建用户
await userApi.create({
  sAMAccountName, displayName, ouDn, password,
  mail, mobile, department, title, forceChangeAtFirstLogin
});

// 更新用户
await userApi.update(username, { displayName, mail, mobile, department, title });

// 启用/禁用
await userApi.setStatus(username, enabled);

// 重置密码
await userApi.resetPassword(username, newPassword, forceChangeAtFirstLogin);

// 删除用户
await userApi.delete(username);

// 批量操作
await userApi.batch(action, usernames);

// 导出
const csv = await userApi.export({ q, ou, status });

// 导入
await userApi.import(csv);
```

### 3. Admin/OUManagement.tsx (OU管理)

**需要更新的API调用：**
```typescript
// 获取OU列表
const { items } = await ouApi.list();

// 创建OU
await ouApi.create({ name, parentDn, description });

// 更新OU
await ouApi.update({ dn, name, description });

// 删除OU
await ouApi.delete(dn);
```

**注意：** OU 使用 DN (Distinguished Name) 而不是简单 ID

### 4. Admin/AuditLog.tsx (审计日志)

**需要更新的API调用：**
```typescript
// 查询日志
const { items } = await auditApi.list({ actor, action, result, limit });

// 导出日志
const csv = await auditApi.export({ limit });
```

**数据映射：**
```typescript
actor -> 操作员
actor_role -> 角色
action -> 操作
target -> 目标
result -> 结果 (ok/error)
created_at -> 时间
before_value -> 变更前
after_value -> 变更后
```

### 5. Admin/ConfigCenter.tsx (配置中心)

**需要更新的API调用：**
```typescript
// 获取配置
const { items } = await configApi.list();

// 更新配置
await configApi.update(key, value);

// 配置历史
const { items } = await configApi.history(limit);

// 回滚
await configApi.rollback(id);
```

### 6. Admin/SystemHealth.tsx (系统健康)

**需要更新的API调用：**
```typescript
// 健康检查详情
const { api, db, ldap } = await healthApi.details();
```

**数据映射：**
```typescript
api: boolean -> API Server状态
db: boolean -> Database状态
ldap: boolean -> LDAP/AD状态
```

## 实现步骤

### 第1步：添加 Loading 状态

在每个组件中添加：
```typescript
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState('');
```

### 第2步：使用 useEffect 加载数据

```typescript
useEffect(() => {
  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await someApi.method();
      setData(response.items);
    } catch (err: any) {
      setError(err.message);
      toast.error('加载失败：' + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  loadData();
}, []);
```

### 第3步：更新操作函数

将模拟操作替换为 API 调用：
```typescript
const handleCreate = async (formData) => {
  setIsLoading(true);
  try {
    await someApi.create(formData);
    toast.success('创建成功');
    // 重新加载数据
    await loadData();
  } catch (err: any) {
    toast.error('创建失败：' + err.message);
  } finally {
    setIsLoading(false);
  }
};
```

### 第4步：处理分页（如需要）

虽然当前后端API未提供分页参数，但前端可以在获取所有数据后进行本地分页。

## 运行配置

### 1. 创建 .env 文件

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置正确的 API 地址。

### 2. 启动前端开发服务器

```bash
npm run dev
```

### 3. 确保后端服务运行

```bash
# 后端应该运行在
http://localhost:8000   # API直连
# 或
http://localhost:8088   # Nginx代理
```

## 错误处理

所有 API 调用都应该包含 try-catch：

```typescript
try {
  await someApi.method();
  toast.success('操作成功');
} catch (err: any) {
  // API 错误会自动被 ApiClient 处理并抛出
  toast.error(err.message || '操作失败');
  console.error('API Error:', err);
}
```

## 数据转换示例

### 用户数据转换
```typescript
// 后端返回
{
  sAMAccountName: "user1",
  displayName: "张三",
  mail: "user1@domain.local",
  mobile: "13800000000",
  department: "销售",
  title: "经理",
  dn: "CN=张三,OU=Sales,DC=domain,DC=local"
}

// 前端使用时
<p>用户名: {user.sAMAccountName}</p>
<p>姓名: {user.displayName}</p>
<p>邮箱: {user.mail}</p>
<p>手机: {user.mobile}</p>
```

### OU数据转换
```typescript
// 后端返回
{
  dn: "OU=Sales,DC=domain,DC=local",
  name: "Sales",
  description: "销售部"
}

// 前端使用
<p>OU名称: {ou.name}</p>
<p>DN: {ou.dn}</p>
```

## 测试清单

- [ ] 普通用户登录
- [ ] 管理员登录 + OTP验证
- [ ] 忘记密码（短信/邮件）
- [ ] 用户个人中心
- [ ] 修改密码
- [ ] 用户管理 CRUD
- [ ] 批量操作用户
- [ ] OU管理 CRUD
- [ ] 审计日志查看和导出
- [ ] 配置中心查看和修改
- [ ] 系统健康检查

## 注意事项

1. **Token 过期处理**：API 客户端会在 401 错误时自动清除 token，用户需要重新登录

2. **OTP 流程**：首次管理员登录需要设置 OTP，保存 secret 后才能使用

3. **DN 格式**：OU 操作使用完整的 DN（如 `OU=Sales,DC=domain,DC=local`）

4. **错误信息**：后端返回的错误信息在 `error.message` 或 `error.detail` 字段

5. **日期格式**：后端返回 ISO 8601 格式，前端需要格式化显示

## 下一步

剩余的工作主要是：
1. 将 `UserDashboard.tsx` 切换到使用 `useAuth().user`
2. 更新 `Admin/UserManagement.tsx` 的所有 CRUD 操作
3. 更新其他管理员组件的 API 调用
4. 添加适当的 loading 状态和错误处理
5. 测试所有功能

所有需要的 API 方法都已经在 `/src/app/utils/api.ts` 中定义好了，直接导入使用即可！
