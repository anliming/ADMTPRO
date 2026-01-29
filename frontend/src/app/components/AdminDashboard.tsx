import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/app/components/ui/sidebar';
import { Shield, LogOut, Users, FolderTree, FileText, Settings, Activity, LayoutDashboard } from 'lucide-react';
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
  const [configSection, setConfigSection] = useState<'configs' | 'history'>('configs');
  const navItems = [
    {
      key: 'users',
      label: '用户管理',
      icon: Users,
      children: ['用户列表'],
    },
    {
      key: 'ou',
      label: 'OU管理',
      icon: FolderTree,
      children: ['组织结构'],
    },
    {
      key: 'audit',
      label: '审计日志',
      icon: FileText,
      children: ['日志记录'],
    },
    {
      key: 'config',
      label: '配置中心',
      icon: Settings,
      children: ['系统配置', '配置变更历史'],
    },
    {
      key: 'health',
      label: '系统健康',
      icon: Activity,
      children: ['运行状态'],
    },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2 py-2">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-9 h-9 object-contain" />
              ) : (
                <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{appName}</div>
                <div className="text-xs text-muted-foreground">管理控制台</div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                管理菜单
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.key;
                    return (
                      <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => {
                          setActiveTab(item.key);
                          if (item.key === 'config') {
                            setConfigSection('configs');
                          }
                        }}
                      >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child}>
                              <SidebarMenuSubButton
                                isActive={active}
                                onClick={() => {
                                  setActiveTab(item.key);
                                  if (item.key === 'config') {
                                    setConfigSection(child === '配置变更历史' ? 'history' : 'configs');
                                  }
                                }}
                              >
                                {child}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="px-2 text-xs text-muted-foreground">管理员：{username}</div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="bg-white border-b sticky top-0 z-10">
            <div className="px-4 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <h1 className="font-semibold">{appName} 管理控制台</h1>
              </div>
              <Button variant="outline" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </div>
          </header>
          <div className="px-4 py-6">
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'ou' && <OUManagement />}
            {activeTab === 'audit' && <AuditLogComponent />}
            {activeTab === 'config' && <ConfigCenter externalSection={configSection} />}
            {activeTab === 'health' && <SystemHealthComponent />}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
