import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Shield, LogOut, Users, FolderTree, FileText, Settings, Activity } from 'lucide-react';
import { UserManagement } from '@/app/components/admin/UserManagement';
import { OUManagement } from '@/app/components/admin/OUManagement';
import { AuditLogComponent } from '@/app/components/admin/AuditLog';
import { ConfigCenter } from '@/app/components/admin/ConfigCenter';
import { SystemHealthComponent } from '@/app/components/admin/SystemHealth';
import { useAuth } from '@/app/contexts/AuthContext';

interface AdminDashboardProps {
  username: string;
  onLogout: () => void;
}

export function AdminDashboard({ username, onLogout }: AdminDashboardProps) {
  const { appConfig } = useAuth();
  const appName = appConfig.APP_NAME || 'ADMTPRO';
  const logoUrl = appConfig.APP_LOGO_URL || '';
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="font-semibold">{appName} 管理控制台</h1>
              <p className="text-sm text-muted-foreground">管理员：{username}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="ou" className="flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              OU管理
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              审计日志
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              配置中心
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              系统健康
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="ou">
            <OUManagement />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogComponent />
          </TabsContent>

          <TabsContent value="config">
            <ConfigCenter />
          </TabsContent>

          <TabsContent value="health">
            <SystemHealthComponent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
