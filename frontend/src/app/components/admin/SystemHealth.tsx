import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Activity, Database, Server, Mail, Smartphone } from 'lucide-react';
import { mockSystemHealth, type SystemHealth } from '@/app/utils/mockData';

export function SystemHealthComponent() {
  const [healthData, setHealthData] = useState<SystemHealth[]>(mockSystemHealth);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());

  const handleRefresh = () => {
    setIsRefreshing(true);
    // 模拟刷新
    setTimeout(() => {
      setHealthData([...mockSystemHealth]);
      setLastRefresh(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }, 1000);
  };

  const getStatusIcon = (status: SystemHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusBadge = (status: SystemHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-600">正常</Badge>;
      case 'degraded':
        return <Badge variant="default" className="bg-amber-600">降级</Badge>;
      case 'down':
        return <Badge variant="destructive">宕机</Badge>;
    }
  };

  const getServiceIcon = (service: string) => {
    if (service.includes('API')) return <Server className="w-6 h-6" />;
    if (service.includes('Database')) return <Database className="w-6 h-6" />;
    if (service.includes('LDAP') || service.includes('AD')) return <Activity className="w-6 h-6" />;
    if (service.includes('短信')) return <Smartphone className="w-6 h-6" />;
    if (service.includes('邮件') || service.includes('SMTP')) return <Mail className="w-6 h-6" />;
    return <Server className="w-6 h-6" />;
  };

  const getResponseTimeColor = (time: number) => {
    if (time < 100) return 'text-green-600';
    if (time < 500) return 'text-amber-600';
    return 'text-red-600';
  };

  const getResponseTimeProgress = (time: number) => {
    // 将响应时间转换为进度条百分比（假设3000ms为100%）
    return Math.min((time / 3000) * 100, 100);
  };

  const healthyCount = healthData.filter(h => h.status === 'healthy').length;
  const degradedCount = healthData.filter(h => h.status === 'degraded').length;
  const downCount = healthData.filter(h => h.status === 'down').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">系统健康检查</h2>
          <p className="text-sm text-muted-foreground mt-1">
            监控系统各服务的运行状态
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新状态
        </Button>
      </div>

      {/* Overall Status */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">服务总数</p>
                <p className="text-2xl font-semibold">{healthData.length}</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">正常服务</p>
                <p className="text-2xl font-semibold text-green-600">{healthyCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">降级服务</p>
                <p className="text-2xl font-semibold text-amber-600">{degradedCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">宕机服务</p>
                <p className="text-2xl font-semibold text-red-600">{downCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Degraded Warning */}
      {degradedCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            检测到 {degradedCount} 个服务运行异常，建议检查相关配置
          </AlertDescription>
        </Alert>
      )}

      {/* Down Error */}
      {downCount > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            检测到 {downCount} 个服务宕机，系统已启用只读降级模式，请立即处理
          </AlertDescription>
        </Alert>
      )}

      {/* Service Details */}
      <div className="grid md:grid-cols-2 gap-4">
        {healthData.map((health, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getServiceIcon(health.service)}
                  <div>
                    <CardTitle className="text-lg">{health.service}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      上次检查: {health.lastCheck}
                    </CardDescription>
                  </div>
                </div>
                {getStatusIcon(health.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">状态</span>
                {getStatusBadge(health.status)}
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">响应时间</span>
                  <span className={`font-semibold ${getResponseTimeColor(health.responseTime)}`}>
                    {health.responseTime} ms
                  </span>
                </div>
                <Progress 
                  value={getResponseTimeProgress(health.responseTime)} 
                  className={
                    health.responseTime < 100 
                      ? 'bg-green-100 [&>div]:bg-green-600' 
                      : health.responseTime < 500 
                      ? 'bg-amber-100 [&>div]:bg-amber-600' 
                      : 'bg-red-100 [&>div]:bg-red-600'
                  }
                />
              </div>

              {health.message && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertDescription className="text-xs text-amber-800">
                    {health.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Info */}
      <Card>
        <CardHeader>
          <CardTitle>系统说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>正常</strong>: 服务运行正常，响应时间在可接受范围内</p>
          <p>• <strong>降级</strong>: 服务可用但性能下降，建议检查配置或资源</p>
          <p>• <strong>宕机</strong>: 服务不可用，系统已启用只读降级模式</p>
          <p>• 上次刷新时间: {lastRefresh}</p>
        </CardContent>
      </Card>
    </div>
  );
}
