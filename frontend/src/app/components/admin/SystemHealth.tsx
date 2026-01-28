import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Activity, Database, Server } from 'lucide-react';
import { healthApi, type HealthStatus } from '@/app/utils/api';
import { toast } from 'sonner';

type HealthItem = {
  name: string;
  ok: boolean;
  icon: JSX.Element;
};

export function SystemHealthComponent() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('');

  const loadHealth = async () => {
    setIsRefreshing(true);
    try {
      const data = await healthApi.details();
      setHealth(data);
      setLastRefresh(new Date().toLocaleString());
    } catch (err: any) {
      toast.error(err.message || '健康检查失败');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const items: HealthItem[] = [
    { name: 'API 服务', ok: !!health?.api, icon: <Server className="w-6 h-6" /> },
    { name: '数据库', ok: !!health?.db, icon: <Database className="w-6 h-6" /> },
    { name: 'LDAP/AD', ok: !!health?.ldap, icon: <Activity className="w-6 h-6" /> },
  ];

  const downCount = items.filter((i) => !i.ok).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">系统健康检查</h2>
          <p className="text-sm text-muted-foreground mt-1">监控系统各服务的运行状态</p>
        </div>
        <Button onClick={loadHealth} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新状态
        </Button>
      </div>

      {downCount > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>检测到 {downCount} 个服务异常，请立即处理</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.icon}
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">上次检查: {lastRefresh || '-'}</CardDescription>
                  </div>
                </div>
                {item.ok ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">状态</span>
                {item.ok ? (
                  <Badge variant="default" className="bg-green-600">
                    正常
                  </Badge>
                ) : (
                  <Badge variant="destructive">异常</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>系统说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>正常</strong>: 服务运行正常</p>
          <p>• <strong>异常</strong>: 服务不可用或连接失败</p>
          <p>• 上次刷新时间: {lastRefresh || '-'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
