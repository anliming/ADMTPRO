import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { User, Lock, LogOut, Bell, Calendar, AlertTriangle } from 'lucide-react';
import { mockUsers, mockPasswordReminders } from '@/app/utils/mockData';

interface UserDashboardProps {
  username: string;
  onLogout: () => void;
}

export function UserDashboard({ username, onLogout }: UserDashboardProps) {
  const currentUser = mockUsers.find(u => u.username === username);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  if (!currentUser) {
    return null;
  }

  const reminder = mockPasswordReminders.find(r => r.userId === currentUser.id);
  const passwordExpiry = new Date(currentUser.passwordExpiry);
  const today = new Date();
  const daysUntilExpiry = Math.ceil((passwordExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const handleSendSms = () => {
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
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword || !smsCode) {
      setError('请填写所有字段');
      return;
    }

    if (newPassword.length < 8) {
      setError('新密码长度至少8位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (smsCode !== '123456') {
      setError('短信验证码错误');
      return;
    }

    // 模拟修改密码
    setSuccess('密码修改成功！');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSmsCode('');
    setTimeout(() => {
      setShowChangePassword(false);
      setSuccess('');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold">ADMTPRO 用户中心</h1>
              <p className="text-sm text-muted-foreground">欢迎回来，{currentUser.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Password Expiry Warning */}
        {daysUntilExpiry <= 7 && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              您的密码将在 {daysUntilExpiry} 天后过期（{currentUser.passwordExpiry}），请及时修改密码
            </AlertDescription>
          </Alert>
        )}

        {/* Must Change Password Warning */}
        {currentUser.mustChangePassword && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              您需要在首次登录时修改密码，请立即修改
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>个人信息</CardTitle>
              <CardDescription>您的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">用户名:</span>
                <span className="col-span-2 text-sm">{currentUser.username}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">姓名:</span>
                <span className="col-span-2 text-sm">{currentUser.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">邮箱:</span>
                <span className="col-span-2 text-sm">{currentUser.email}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">手机号:</span>
                <span className="col-span-2 text-sm">{currentUser.phone}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">部门:</span>
                <span className="col-span-2 text-sm">{currentUser.department}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">岗位:</span>
                <span className="col-span-2 text-sm">{currentUser.position}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">状态:</span>
                <div className="col-span-2">
                  <Badge variant={currentUser.status === 'active' ? 'default' : 'secondary'}>
                    {currentUser.status === 'active' ? '正常' : '禁用'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card>
            <CardHeader>
              <CardTitle>账号安全</CardTitle>
              <CardDescription>密码和安全设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">密码到期:</span>
                <span className="col-span-2 text-sm">{currentUser.passwordExpiry}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">剩余天数:</span>
                <span className="col-span-2 text-sm">
                  <Badge variant={daysUntilExpiry <= 7 ? 'destructive' : 'secondary'}>
                    {daysUntilExpiry} 天
                  </Badge>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-muted-foreground">上次登录:</span>
                <span className="col-span-2 text-sm">{currentUser.lastLogin}</span>
              </div>
              
              <Button className="w-full" onClick={() => setShowChangePassword(true)}>
                <Lock className="w-4 h-4 mr-2" />
                修改密码
              </Button>
              
              <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>修改密码</DialogTitle>
                    <DialogDescription>
                      为了您的账号安全，需要验证旧密码和短信验证码
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    {success && (
                      <Alert className="border-green-200 bg-green-50">
                        <AlertDescription className="text-green-800">{success}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="old-password">旧密码</Label>
                      <Input
                        id="old-password"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">新密码</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        至少8位，包含大小写字母、数字和特殊字符
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">确认新密码</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sms-code">短信验证码</Label>
                      <div className="flex gap-2">
                        <Input
                          id="sms-code"
                          type="text"
                          value={smsCode}
                          onChange={(e) => setSmsCode(e.target.value)}
                          placeholder="6位验证码"
                          maxLength={6}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={countdown > 0}
                          onClick={handleSendSms}
                        >
                          {countdown > 0 ? `${countdown}s` : '发送'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        验证码将发送至 {currentUser.phone}
                      </p>
                    </div>

                    <Button type="submit" className="w-full">
                      确认修改
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      演示验证码: 123456
                    </p>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Password Reminder History */}
        {reminder && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                密码到期提醒记录
              </CardTitle>
              <CardDescription>系统发送的密码到期提醒通知</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">密码即将过期提醒</p>
                      <p className="text-xs text-muted-foreground">
                        您的密码将在 {reminder.daysRemaining} 天后过期
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">通知时间</p>
                    <p className="text-sm">{reminder.notifiedAt}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}