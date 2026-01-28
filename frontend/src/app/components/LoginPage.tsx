import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { User, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';

interface LoginPageProps {
  onNavigateToForgotPassword: () => void;
}

export function LoginPage({ onNavigateToForgotPassword }: LoginPageProps) {
  const { login, appConfig } = useAuth();
  const logoUrl = appConfig.APP_LOGO_URL || '';
  const appName = appConfig.APP_NAME || 'ADMTPRO';
  const loginBanner = appConfig.APP_LOGIN_BANNER || '';
  const primaryColor = appConfig.APP_PRIMARY_COLOR || '#2563eb';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4"
      style={loginBanner ? { backgroundImage: `url(${loginBanner})`, backgroundSize: 'cover' } : undefined}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="mx-auto h-14 w-14 object-contain" />
          ) : (
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
              <User className="w-8 h-8 text-white" />
            </div>
          )}
          <CardTitle className="text-2xl">{appName} 用户登录</CardTitle>
          <CardDescription>请输入您的账号和密码登录系统</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                className="text-sm px-0"
                onClick={onNavigateToForgotPassword}
                disabled={isLoading}
              >
                忘记密码?
              </Button>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  登录
                </>
              )}
            </Button>

            
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
