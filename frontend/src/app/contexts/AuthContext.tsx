import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, TokenManager, type User } from '@/app/utils/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  appConfig: Record<string, any>;
  login: (username: string, password: string) => Promise<void>;
  adminLogin: (username: string, password: string) => Promise<{ requiresOtp: boolean; otpToken?: string; otpSetupRequired?: boolean }>;
  verifyOtp: (otpToken: string, code: string) => Promise<void>;
  setupOtp: (otpToken: string) => Promise<{ secret: string; otpauth_uri: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appConfig, setAppConfig] = useState<Record<string, any>>({});

  // 初始化时检查token并加载用户信息
  useEffect(() => {
    const initAuth = async () => {
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const payload = await configRes.json();
          const items = payload.items || payload;
          setAppConfig(items || {});
        }
      } catch (error) {
        console.error('Failed to load app config:', error);
      }
      const token = TokenManager.getToken();
      if (token) {
        try {
          const userData = await authApi.me();
          setUser(userData);
          // 简单判断：如果能访问/me接口，根据localStorage标记判断是否管理员
          const adminFlag = localStorage.getItem('admtpro_is_admin');
          setIsAdmin(adminFlag === 'true');
        } catch (error) {
          console.error('Failed to load user:', error);
          TokenManager.clear();
          localStorage.removeItem('admtpro_is_admin');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    TokenManager.setToken(response.token);
    setUser(response.user);
    setIsAdmin(false);
    localStorage.setItem('admtpro_is_admin', 'false');
  };

  const adminLogin = async (username: string, password: string) => {
    const response = await authApi.adminLogin(username, password);
    
    if (response.otp_required && response.otp_token) {
      return {
        requiresOtp: true,
        otpToken: response.otp_token,
        otpSetupRequired: response.otp_setup_required,
      };
    }
    
    // 如果不需要OTP（理论上管理员都需要）
    if (response.token) {
      TokenManager.setToken(response.token);
      const userData = await authApi.me();
      setUser(userData);
      setIsAdmin(true);
      localStorage.setItem('admtpro_is_admin', 'true');
    }
    
    return { requiresOtp: false };
  };

  const setupOtp = async (otpToken: string) => {
    const response = await authApi.otpSetup(otpToken);
    return response;
  };

  const verifyOtp = async (otpToken: string, code: string) => {
    const response = await authApi.otpVerify(otpToken, code);
    TokenManager.setToken(response.token);
    const userData = await authApi.me();
    setUser(userData);
    setIsAdmin(true);
    localStorage.setItem('admtpro_is_admin', 'true');
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      TokenManager.clear();
      localStorage.removeItem('admtpro_is_admin');
      setUser(null);
      setIsAdmin(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin,
        isLoading,
        appConfig,
        login,
        adminLogin,
        verifyOtp,
        setupOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
