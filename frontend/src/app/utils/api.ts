// API 客户端配置
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const resolvedBaseUrl = rawBaseUrl && rawBaseUrl !== '/' ? rawBaseUrl : '/api';
const API_BASE_URL = resolvedBaseUrl.endsWith('/')
  ? resolvedBaseUrl.slice(0, -1)
  : resolvedBaseUrl;

// Token 管理
class TokenManager {
  private static TOKEN_KEY = 'admtpro_token';
  private static OTP_TOKEN_KEY = 'admtpro_otp_token';

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static getOtpToken(): string | null {
    return localStorage.getItem(this.OTP_TOKEN_KEY);
  }

  static setOtpToken(token: string): void {
    localStorage.setItem(this.OTP_TOKEN_KEY, token);
  }

  static removeOtpToken(): void {
    localStorage.removeItem(this.OTP_TOKEN_KEY);
  }

  static clear(): void {
    this.removeToken();
    this.removeOtpToken();
  }
}

// API 请求封装
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = TokenManager.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      const err = new Error(error.message || error.detail || `HTTP ${response.status}`) as Error & {
        code?: string;
        status?: number;
      };
      err.code = error.code;
      err.status = response.status;
      throw err;
    }

    // 处理空响应
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response.text() as any;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(endpoint + queryString, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

const api = new ApiClient(API_BASE_URL);

// 类型定义
export interface User {
  sAMAccountName: string;
  displayName: string;
  mail: string;
  mobile: string;
  department?: string;
  title?: string;
  dn?: string;
  enabled?: boolean;
  passwordExpiryDate?: string;
  mustChangePassword?: boolean;
  days_left?: number | null;
  password_expiry_date?: string | null;
  account_expiry_date?: string | null;
  password_never_expires?: boolean;
}

export interface OU {
  dn: string;
  name: string;
  description?: string;
  parentDn?: string;
}

export interface AuditLog {
  id: number;
  actor: string;
  actor_role: string;
  action: string;
  target: string;
  result: string;
  detail: string;
  created_at: string;
  before_value?: any;
  after_value?: any;
}

export interface Config {
  key: string;
  value: any;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface HealthStatus {
  api: boolean;
  db: boolean;
  ldap: boolean;
}

export interface Notification {
  id: number;
  username: string;
  days_left: number;
  status: string;
  notify_date: string;
}

// API 方法
export const authApi = {
  // 普通用户登录
  login: (username: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', {
      username,
      password,
      roleHint: 'user',
    }),

  // 管理员登录
  adminLogin: (username: string, password: string) =>
    api.post<{ otp_required?: boolean; otp_setup_required?: boolean; otp_token?: string; token?: string }>('/auth/login', {
      username,
      password,
      roleHint: 'admin',
    }),

  // OTP设置
  otpSetup: (otpToken: string) =>
    api.post<{ secret: string; otpauth_uri: string }>('/auth/otp/setup', {
      otp_token: otpToken,
    }),

  // OTP验证
  otpVerify: (otpToken: string, code: string) =>
    api.post<{ token: string }>('/auth/otp/verify', {
      otp_token: otpToken,
      code,
    }),

  // 管理员高危操作 OTP 验证
  otpVerifyAction: (code: string) =>
    api.post<{ status: string }>('/auth/otp/verify-action', {
      code,
    }),

  // 退出登录
  logout: () => api.post<{ status: string }>('/auth/logout'),

  // 获取当前用户信息
  me: () => api.get<User>('/me'),

  // 发送短信验证码
  sendSms: (username: string, scene: 'forgot' | 'change') =>
    api.post<{ status: string }>('/auth/sms/send', { username, scene }),

  // 忘记密码（短信）
  forgotPasswordSms: (username: string, code: string, newPassword: string) =>
    api.post<{ status: string }>('/auth/forgot/reset', {
      username,
      code,
      newPassword,
    }),

  // 发送邮件验证码
  sendEmail: (username: string, scene: 'forgot' | 'change') =>
    api.post<{ status: string }>('/auth/email/send', { username, scene }),

  // 忘记密码（邮箱）
  forgotPasswordEmail: (username: string, code: string, newPassword: string) =>
    api.post<{ status: string }>('/auth/email/reset', {
      username,
      code,
      newPassword,
    }),

  // 修改密码
  changePassword: (oldPassword: string, newPassword: string, code: string) =>
    api.post<{ status: string }>('/me/password', {
      oldPassword,
      newPassword,
      code,
    }),
};

export const userApi = {
  // 查询用户
  list: (params?: { q?: string; ou?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<{ items: User[]; total: number; page: number; pageSize: number }>('/users', params),

  // 用户详情
  detail: (username: string) =>
    api.get<{ item: User }>(`/users/${encodeURIComponent(username)}`),

  // 创建用户
  create: (data: {
    sAMAccountName: string;
    displayName: string;
    ouDn: string;
    password: string;
    mail?: string;
    mobile?: string;
    department?: string;
    title?: string;
    forceChangeAtFirstLogin?: boolean;
  }) => api.post<{ status: string }>('/users', data),

  // 更新用户
  update: (username: string, data: Partial<User>) =>
    api.put<{ status: string }>(`/users/${username}`, data),

  // 启用/禁用用户
  setStatus: (username: string, enabled: boolean) =>
    api.patch<{ status: string }>(`/users/${username}/status`, { enabled }),

  // 重置密码
  resetPassword: (username: string, newPassword: string, forceChangeAtFirstLogin: boolean) =>
    api.post<{ status: string }>(`/users/${username}/reset-password`, {
      newPassword,
      forceChangeAtFirstLogin,
    }),

  // 移动用户
  move: (username: string, targetOuDn: string) =>
    api.post<{ status: string }>(`/users/${username}/move`, { targetOuDn }),

  // 删除用户
  delete: (username: string) =>
    api.delete<{ status: string }>(`/users/${username}`),

  // 批量操作
  batch: (action: string, usernames: string[]) =>
    api.post<{ count: number }>('/users/batch', { action, usernames }),

  // 导出CSV
  export: (params?: { q?: string; ou?: string; status?: string }) =>
    api.get<string>('/users/export', params),

  // 导入CSV
  import: (csv: string) =>
    api.post<{ created: number; errors: any[] }>('/users/import', { csv }),
};

export const ouApi = {
  // OU列表
  list: () => api.get<{ items: OU[] }>('/ous'),

  // 创建OU
  create: (data: { name: string; parentDn: string; description?: string }) =>
    api.post<{ status: string }>('/ous', data),

  // 更新OU
  update: (data: { dn: string; name?: string; description?: string }) =>
    api.put<{ status: string }>('/ous', data),

  // 删除OU
  delete: (dn: string) =>
    api.delete<{ status: string }>('/ous', { dn }),
};

export const auditApi = {
  // 审计日志查询
  list: (params?: {
    actor?: string;
    action?: string;
    result?: string;
    target?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<{ items: AuditLog[]; total?: number; page?: number; pageSize?: number }>('/audit', params),

  // 导出审计日志
  export: (params?: { limit?: number }) =>
    api.get<string>('/audit/export', params),
};

export const configApi = {
  // 获取配置
  list: () => api.get<{ items: Record<string, any>; descriptions: Record<string, string> }>('/config'),

  // 更新配置
  update: (key: string, value: any) =>
    api.put<{ status: string }>('/config', { [key]: value }),

  // 配置历史
  history: (limit?: number) =>
    api.get<{ items: any[] }>('/config/history', { limit }),

  // 回滚配置
  rollback: (id: number) =>
    api.post<{ status: string }>('/config/rollback', { id }),
};

export const healthApi = {
  // 健康检查
  check: () => api.get<{ status: string }>('/health'),

  // 详细健康检查
  details: () => api.get<HealthStatus>('/health/details'),
};

export const notificationApi = {
  // 获取通知
  list: () => api.get<{ items: Notification[] }>('/notifications'),
};

export const passwordExpiryApi = {
  // 密码到期列表
  list: (params?: { username?: string; status?: string; limit?: number }) =>
    api.get<{ items: any[] }>('/password-expiry/list', params),

  // 触发密码到期检查
  trigger: () => api.post<{ status: string }>('/password-expiry/trigger'),
};

export const passwordPolicyApi = {
  get: () =>
    api.get<{
      items: {
        min_length?: number | null;
        history_length?: number | null;
        max_age_days?: number | null;
        min_age_days?: number | null;
        pwd_properties?: number | null;
        lockout_threshold?: number | null;
        complexity_enabled?: boolean | null;
        reversible_encryption?: boolean | null;
      };
    }>('/password-policy'),
};

export const smsApi = {
  // 短信日志
  list: (params?: { username?: string; scene?: string; status?: string; limit?: number }) =>
    api.get<{ items: any[] }>('/sms/list', params),

  // 短信重试
  retry: () => api.post<{ status: string; retried: number; errors: any[] }>('/sms/retry'),
};

export { TokenManager };
export default api;
