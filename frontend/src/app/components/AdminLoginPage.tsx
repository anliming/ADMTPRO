import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/app/components/ui/input-otp';
import { Shield, ArrowLeft, Loader2, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '@/app/contexts/AuthContext';

interface AdminLoginPageProps {
  onNavigateToUser: () => void;
}

export function AdminLoginPage({ onNavigateToUser }: AdminLoginPageProps) {
  const { adminLogin, verifyOtp, setupOtp, appConfig } = useAuth();
  const logoUrl = appConfig.APP_LOGO_URL || '';
  const appName = appConfig.APP_NAME || 'ADMTPRO';
  const loginBanner = appConfig.APP_LOGIN_BANNER || '';
  const primaryColor = appConfig.APP_PRIMARY_COLOR || '#6d28d9';
  const [step, setStep] = useState<'credentials' | 'otp-setup' | 'otp-verify'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpSecret, setOtpSecret] = useState('');
  const [otpUri, setOtpUri] = useState('');
  const [otpQrDataUrl, setOtpQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await adminLogin(username, password);
      
      if (response.requiresOtp && response.otpToken) {
        setOtpToken(response.otpToken);
        
        if (response.otpSetupRequired) {
          // 需要首次设置OTP
          const otpSetupData = await setupOtp(response.otpToken);
          setOtpSecret(otpSetupData.secret);
          setOtpUri(otpSetupData.otpauth_uri);
          setStep('otp-setup');
        } else {
          // 直接验证OTP
          setStep('otp-verify');
        }
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('无权限')) {
        setError('无权限登录，请返回普通登录');
      } else {
        setError(msg || '登录失败，请检查用户名和密码');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (otp.length !== 6) {
      setError('请输入6位OTP验证码');
      return;
    }

    setIsLoading(true);
    try {
      await verifyOtp(otpToken, otp);
    } catch (err: any) {
      setError(err.message || 'OTP验证码错误');
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setStep('otp-verify');
    setOtp('');
  };

  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      if (!otpUri) {
        setOtpQrDataUrl('');
        return;
      }
      try {
        const dataUrl = await QRCode.toDataURL(otpUri, { margin: 1, width: 220 });
        if (!cancelled) setOtpQrDataUrl(dataUrl);
      } catch (err) {
        if (!cancelled) setOtpQrDataUrl('');
      }
    };
    generate();
    return () => {
      cancelled = true;
    };
  }, [otpUri]);

  const handleRebindOtp = async () => {
    setError('');
    if (!otpToken) {
      setError('请先完成账号密码验证');
      return;
    }
    setIsLoading(true);
    try {
      const otpSetupData = await setupOtp(otpToken);
      setOtpSecret(otpSetupData.secret);
      setOtpUri(otpSetupData.otpauth_uri);
      setStep('otp-setup');
    } catch (err: any) {
      setError(err.message || 'OTP 绑定失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={
        loginBanner
          ? { backgroundImage: `url(${loginBanner})`, backgroundSize: 'cover' }
          : { backgroundColor: 'var(--app-page-bg)' }
      }
    >
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="mx-auto h-14 w-14 object-contain" />
          ) : (
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
          )}
          <CardTitle className="text-2xl text-center">{appName}</CardTitle>
          <CardDescription>
            {step === 'credentials' && '请输入管理员账号和密码'}
            {step === 'otp-setup' && '首次登录需要设置OTP二次验证'}
            {step === 'otp-verify' && '请输入OTP二次验证码'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="admin-username">管理员账号</Label>
                <Input
                  id="admin-username"
                  type="text"
                  placeholder="请输入管理员账号"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="admin-password">密码</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '下一步：OTP验证'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onNavigateToUser}
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回普通用户登录
              </Button>
            </form>
          )}

          {step === 'otp-setup' && (
            <div className="space-y-4">
              <Alert>
                <QrCode className="h-4 w-4" />
                <AlertDescription>
                  请使用身份验证器应用（如 Google Authenticator）扫描二维码或手动输入密钥
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 bg-white">
                <div className="text-center space-y-3">
                  {otpQrDataUrl ? (
                    <img src={otpQrDataUrl} alt="OTP QR Code" className="mx-auto h-40 w-40" />
                  ) : (
                    <div className="text-xs text-muted-foreground">二维码生成中...</div>
                  )}
                  <p className="text-sm font-medium">手动输入密钥</p>
                  <div className="bg-muted p-3 rounded font-mono text-sm break-all">
                    {otpSecret}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    账号: {username}
                  </p>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  <strong>OTP URI:</strong>
                  <div className="mt-1 font-mono text-xs break-all bg-muted p-2 rounded">
                    {otpUri}
                  </div>
                </AlertDescription>
              </Alert>

              <Button
                type="button"
                className="w-full"
                onClick={handleSetupComplete}
              >
                已添加，继续验证
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep('credentials');
                  setOtp('');
                  setOtpToken('');
                  setError('');
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回上一步
              </Button>
            </div>
          )}

          {step === 'otp-verify' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Alert>
                <AlertDescription>
                  请打开您的身份验证器应用获取6位验证码
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="otp">OTP验证码</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={isLoading}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    验证中...
                  </>
                ) : (
                  '验证并登录'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleRebindOtp}
                disabled={isLoading}
              >
                无法验证？重新绑定 OTP
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep('credentials');
                  setOtp('');
                  setOtpToken('');
                  setError('');
                }}
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回上一步
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
