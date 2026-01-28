// 模拟数据和类型定义

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  ou: string;
  status: 'active' | 'disabled';
  passwordExpiry: string;
  createdAt: string;
  lastLogin: string;
  mustChangePassword: boolean;
}

export interface OU {
  id: string;
  name: string;
  parentId: string | null;
  description: string;
  userCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  operator: string;
  operatorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  before: any;
  after: any;
  ip: string;
  result: 'success' | 'failed';
}

export interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: string;
  message?: string;
}

export interface PasswordReminder {
  id: string;
  userId: string;
  daysRemaining: number;
  expiryDate: string;
  notified: boolean;
  notifiedAt?: string;
}

// 模拟用户数据
export const mockUsers: User[] = [
  {
    id: '1',
    username: 'zhangsan',
    name: '张三',
    email: 'zhangsan@example.com',
    phone: '13800138000',
    department: '技术部',
    position: '高级工程师',
    ou: 'ou1',
    status: 'active',
    passwordExpiry: '2026-03-15',
    createdAt: '2025-01-01',
    lastLogin: '2026-01-27 09:30',
    mustChangePassword: false,
  },
  {
    id: '2',
    username: 'lisi',
    name: '李四',
    email: 'lisi@example.com',
    phone: '13800138001',
    department: '市场部',
    position: '市场经理',
    ou: 'ou2',
    status: 'active',
    passwordExpiry: '2026-02-05',
    createdAt: '2025-01-15',
    lastLogin: '2026-01-26 14:20',
    mustChangePassword: false,
  },
  {
    id: '3',
    username: 'wangwu',
    name: '王五',
    email: 'wangwu@example.com',
    phone: '13800138002',
    department: '人力资源部',
    position: '人事专员',
    ou: 'ou3',
    status: 'disabled',
    passwordExpiry: '2026-04-20',
    createdAt: '2024-12-01',
    lastLogin: '2026-01-20 11:15',
    mustChangePassword: true,
  },
];

// 模拟 OU 数据
export const mockOUs: OU[] = [
  {
    id: 'ou1',
    name: '技术部',
    parentId: null,
    description: '负责技术研发与维护',
    userCount: 15,
  },
  {
    id: 'ou2',
    name: '市场部',
    parentId: null,
    description: '负责市场营销与推广',
    userCount: 8,
  },
  {
    id: 'ou3',
    name: '人力资源部',
    parentId: null,
    description: '负责人力资源管理',
    userCount: 5,
  },
  {
    id: 'ou4',
    name: '前端团队',
    parentId: 'ou1',
    description: '前端开发团队',
    userCount: 7,
  },
  {
    id: 'ou5',
    name: '后端团队',
    parentId: 'ou1',
    description: '后端开发团队',
    userCount: 8,
  },
];

// 模拟审计日志
export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log1',
    timestamp: '2026-01-27 10:30:15',
    operator: 'admin',
    operatorRole: '管理员',
    action: '创建用户',
    targetType: '用户',
    targetId: '3',
    targetName: '王五',
    before: null,
    after: { username: 'wangwu', name: '王五', department: '人力资源部' },
    ip: '192.168.1.100',
    result: 'success',
  },
  {
    id: 'log2',
    timestamp: '2026-01-27 09:15:30',
    operator: 'admin',
    operatorRole: '管理员',
    action: '重置密码',
    targetType: '用户',
    targetId: '2',
    targetName: '李四',
    before: { mustChangePassword: false },
    after: { mustChangePassword: true },
    ip: '192.168.1.100',
    result: 'success',
  },
  {
    id: 'log3',
    timestamp: '2026-01-26 16:45:20',
    operator: 'admin',
    operatorRole: '管理员',
    action: '禁用用户',
    targetType: '用户',
    targetId: '3',
    targetName: '王五',
    before: { status: 'active' },
    after: { status: 'disabled' },
    ip: '192.168.1.100',
    result: 'success',
  },
  {
    id: 'log4',
    timestamp: '2026-01-26 14:20:10',
    operator: 'admin',
    operatorRole: '管理员',
    action: '创建OU',
    targetType: 'OU',
    targetId: 'ou5',
    targetName: '后端团队',
    before: null,
    after: { name: '后端团队', parentId: 'ou1' },
    ip: '192.168.1.100',
    result: 'success',
  },
];

// 模拟系统健康状态
export const mockSystemHealth: SystemHealth[] = [
  {
    service: 'API Server',
    status: 'healthy',
    responseTime: 45,
    lastCheck: '2026-01-27 10:35:00',
  },
  {
    service: 'Database',
    status: 'healthy',
    responseTime: 12,
    lastCheck: '2026-01-27 10:35:00',
  },
  {
    service: 'LDAP/AD',
    status: 'healthy',
    responseTime: 78,
    lastCheck: '2026-01-27 10:35:00',
  },
  {
    service: '短信服务',
    status: 'healthy',
    responseTime: 156,
    lastCheck: '2026-01-27 10:35:00',
  },
  {
    service: 'SMTP邮件',
    status: 'degraded',
    responseTime: 2340,
    lastCheck: '2026-01-27 10:35:00',
    message: '响应时间较慢',
  },
];

// 模拟密码到期提醒
export const mockPasswordReminders: PasswordReminder[] = [
  {
    id: 'r1',
    userId: '1',
    daysRemaining: 7,
    expiryDate: '2026-02-03',
    notified: true,
    notifiedAt: '2026-01-27 08:00:00',
  },
  {
    id: 'r2',
    userId: '2',
    daysRemaining: 3,
    expiryDate: '2026-01-30',
    notified: true,
    notifiedAt: '2026-01-27 08:00:00',
  },
];

// 模拟配置数据
export interface Config {
  category: string;
  key: string;
  value: string;
  description: string;
  lastModified: string;
  modifiedBy: string;
}

export const mockConfigs: Config[] = [
  {
    category: 'LDAP',
    key: 'ldap.server',
    value: 'ldap://192.168.1.10:389',
    description: 'LDAP服务器地址',
    lastModified: '2026-01-15 10:00:00',
    modifiedBy: 'admin',
  },
  {
    category: 'LDAP',
    key: 'ldap.base_dn',
    value: 'dc=example,dc=com',
    description: 'LDAP基础DN',
    lastModified: '2026-01-15 10:00:00',
    modifiedBy: 'admin',
  },
  {
    category: '短信',
    key: 'sms.provider',
    value: 'aliyun',
    description: '短信服务提供商',
    lastModified: '2026-01-10 14:30:00',
    modifiedBy: 'admin',
  },
  {
    category: '短信',
    key: 'sms.access_key',
    value: 'LTAI***************',
    description: '阿里云AccessKey',
    lastModified: '2026-01-10 14:30:00',
    modifiedBy: 'admin',
  },
  {
    category: 'OTP',
    key: 'otp.enabled',
    value: 'true',
    description: '启用OTP二次验证',
    lastModified: '2026-01-01 09:00:00',
    modifiedBy: 'admin',
  },
  {
    category: '密码策略',
    key: 'password.min_length',
    value: '8',
    description: '密码最小长度',
    lastModified: '2026-01-01 09:00:00',
    modifiedBy: 'admin',
  },
  {
    category: '密码策略',
    key: 'password.expiry_days',
    value: '90',
    description: '密码有效期（天）',
    lastModified: '2026-01-01 09:00:00',
    modifiedBy: 'admin',
  },
  {
    category: '提醒',
    key: 'reminder.days',
    value: '7,3,1',
    description: '密码到期提醒天数',
    lastModified: '2026-01-01 09:00:00',
    modifiedBy: 'admin',
  },
];
