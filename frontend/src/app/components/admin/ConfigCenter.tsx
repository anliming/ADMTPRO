import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Settings, Edit, Save, History, RefreshCw, RotateCcw } from 'lucide-react';
import { configApi } from '@/app/utils/api';
import { toast } from 'sonner';

type ConfigItem = {
  key: string;
  value: any;
  category: string;
  description?: string;
};

type HistoryItem = {
  id: number;
  key: string;
  value: any;
  created_at: string;
};

const categoryForKey = (key: string): string => {
  if (key.startsWith('APP_')) return '系统';
  if (key.startsWith('LDAP_') || key.startsWith('ADMIN_')) return 'LDAP';
  if (key.startsWith('OTP_')) return 'OTP';
  if (key.startsWith('SMS_') || key.startsWith('ALIYUN_') || key.startsWith('SMTP_')) return '短信/邮件';
  if (key.startsWith('PASSWORD_') || key.startsWith('LOGIN_') || key.startsWith('SESSION_')) return '密码策略';
  return '其他';
};

const maskIfSensitive = (key: string, value: any) => {
  const upper = key.toUpperCase();
  if (upper.includes('PASSWORD') || upper.includes('SECRET') || upper.includes('KEY')) {
    return '***';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const parseValue = (input: string) => {
  const trimmed = input.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
  return input;
};

export function ConfigCenter() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const data = await configApi.list();
      const items = Object.entries(data.items || {}).map(([key, value]) => ({
        key,
        value,
        category: categoryForKey(key),
        description: data.descriptions?.[key],
      }));
      setConfigs(items);
      const hist = await configApi.history(50);
      setHistory(hist.items || []);
    } catch (err: any) {
      toast.error(err.message || '加载配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const categories = useMemo(() => Array.from(new Set(configs.map((c) => c.category))), [configs]);

  const handleEdit = (config: ConfigItem) => {
    setSelectedConfig(config);
    setEditValue(String(config.value ?? ''));
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!selectedConfig) return;
    try {
      await configApi.update(selectedConfig.key, parseValue(editValue));
      toast.success('配置已更新');
      setShowEdit(false);
      await loadConfigs();
    } catch (err: any) {
      toast.error(err.message || '更新失败');
    }
  };

  const handleRollback = async (id: number) => {
    if (!confirm('确定要回滚该配置吗？')) return;
    try {
      await configApi.rollback(id);
      toast.success('回滚成功');
      await loadConfigs();
    } catch (err: any) {
      toast.error(err.message || '回滚失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">配置中心</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理系统配置参数，共 {configs.length} 项配置
          </p>
        </div>
        <Button variant="outline" onClick={loadConfigs} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {categories.length > 0 && (
        <Tabs defaultValue={categories[0]}>
          <TabsList className="grid w-full grid-cols-5">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category} value={category} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {category} 配置
                  </CardTitle>
                  <CardDescription>系统配置项</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">配置项</TableHead>
                        <TableHead className="w-1/3">值</TableHead>
                        <TableHead>说明</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configs
                        .filter((c) => c.category === category)
                        .map((config) => (
                          <TableRow key={config.key}>
                            <TableCell className="font-medium font-mono text-sm">{config.key}</TableCell>
                            <TableCell className="font-mono text-sm">
                              <Badge variant="outline">{maskIfSensitive(config.key, config.value)}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {config.description || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(config)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Configuration History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            配置变更历史
          </CardTitle>
          <CardDescription>最近的配置修改记录</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无历史记录</div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{categoryForKey(item.key)}</Badge>
                    <div>
                      <p className="text-sm font-medium">{item.key}</p>
                      <p className="text-xs text-muted-foreground">值: {maskIfSensitive(item.key, item.value)}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.created_at}</p>
                      <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleRollback(item.id)}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑配置</DialogTitle>
            <DialogDescription>修改配置值，请谨慎操作</DialogDescription>
          </DialogHeader>
          {selectedConfig && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>配置项</Label>
                <Input value={selectedConfig.key} disabled />
              </div>
              {selectedConfig.description && (
                <div className="space-y-2">
                  <Label>说明</Label>
                  <Input value={selectedConfig.description} disabled />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="config-value">配置值</Label>
                <Input
                  id="config-value"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="请输入配置值"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEdit(false)}>
                  取消
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
