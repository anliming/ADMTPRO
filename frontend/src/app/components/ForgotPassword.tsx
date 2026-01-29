import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { ArrowLeft, Mail, Smartphone, CheckCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/app/utils/api';

interface ForgotPasswordProps {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [step, setStep] = useState<'identify' | 'verify' | 'reset' | 'success'>('identify');
  const [method, setMethod] = useState<'sms' | 'email'>('sms');
  const [username, setUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username) {
      setError('请输入用户名');
      return;
    }

    setIsLoading(true);
    try {
      if (method === 'sms') {
        await authApi.sendSms(username, 'forgot');
      } else {
        await authApi.sendEmail(username, 'forgot');
      }
      
      setStep('verify');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || '发送验证码失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!verificationCode) {
      setError('请输入验证码');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    // 验证码正确，进入重置密码步骤
    setStep('reset');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('请输入新密码');
      return;
    }

    if (newPassword.length < 8) {
      setError('密码长度至少8位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      if (method === 'sms') {
        await authApi.forgotPasswordSms(username, verificationCode, newPassword);
      } else {
        await authApi.forgotPasswordEmail(username, verificationCode, newPassword);
      }
      setStep('success');
    } catch (err: any) {
      setError(err.message || '密码重置失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--app-page-bg)' }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">忘记密码</CardTitle>
          <CardDescription>
            {step === 'identify' && '请选择验证方式并输入账号信息'}
            {step === 'verify' && '请输入收到的验证码'}
            {step === 'reset' && '请设置新密码'}
            {step === 'success' && '密码重置成功'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'identify' && (
            <form onSubmit={handleIdentify} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-0">
                  <AlertDescription className="text-base font-semibold">{error}</AlertDescription>
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
                />
              </div>

              <Tabs value={method} onValueChange={(v) => setMethod(v as 'sms' | 'email')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sms">
                    <Smartphone className="w-4 h-4 mr-2" />
                    短信验证
                  </TabsTrigger>
                  <TabsTrigger value="email">
                    <Mail className="w-4 h-4 mr-2" />
                    邮箱验证
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="sms" className="space-y-2 mt-4">
                  <Alert className="border-0">
                    <AlertDescription className="text-base font-semibold">
                      验证码将发送至您的手机号
                    </AlertDescription>
                  </Alert>
                </TabsContent>
                <TabsContent value="email" className="space-y-2 mt-4">
                  <Alert className="border-0">
                    <AlertDescription className="text-base font-semibold">
                      验证码将发送至您的邮箱地址
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : '发送验证码'}
              </Button>

              <Button type="button" variant="outline" className="w-full" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回登录
              </Button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-0">
                  <AlertDescription className="text-base font-semibold">{error}</AlertDescription>
                </Alert>
              )}

              <Alert className="border-0">
                <AlertDescription className="text-base font-semibold">
                  验证码已发送，请查收{method === 'sms' ? '短信' : '邮件'}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="code">验证码</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="请输入6位验证码"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={countdown > 0}
                  onClick={handleIdentify}
                >
                  {countdown > 0 ? `${countdown}秒后重发` : '重新发送'}
                </Button>
                <Button type="submit" className="flex-1">
                  验证
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setStep('identify')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回上一步
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                演示验证码: 123456
              </p>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-0">
                  <AlertDescription className="text-base font-semibold">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="请输入新密码（至少8位）"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">确认密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="请再次输入新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Alert className="border-0">
                <AlertDescription className="text-base font-semibold">
                  密码要求：至少8位，包含大小写字母、数字和特殊字符
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full">
                重置密码
              </Button>
            </form>
          )}

          {step === 'success' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-lg font-medium">密码重置成功！</p>
                <p className="text-sm text-muted-foreground">
                  您的密码已成功重置，请使用新密码登录
                </p>
              </div>

              <Button className="w-full" onClick={onBack}>
                返回登录
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
