import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Settings, Edit, Save, RotateCcw, History } from 'lucide-react';
import { mockConfigs, type Config } from '@/app/utils/mockData';
import { toast } from 'sonner';

export function ConfigCenter() {
  const [configs, setConfigs] = useState<Config[]>(mockConfigs);
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editValue, setEditValue] = useState('');

  const categories = Array.from(new Set(configs.map(c => c.category)));

  const handleEdit = (config: Config) => {
    setSelectedConfig(config);
    setEditValue(config.value);
    setShowEdit(true);
  };

  const handleSave = () => {
    if (!selectedConfig) return;
    
    setConfigs(configs.map(c => 
      c.key === selectedConfig.key 
        ? { 
            ...c, 
            value: editValue, 
            lastModified: new Date().toISOString().replace('T', ' ').substring(0, 19),
            modifiedBy: 'admin'
          }
        : c
    ));
    setShowEdit(false);
    toast.success('配置已更新');
  };

  const handleReset = (config: Config) => {
    if (confirm('确定要重置此配置吗？')) {
      toast.success('配置已重置为默认值');
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
      </div>

      <Tabs defaultValue={categories[0]}>
        <TabsList className="grid w-full grid-cols-5">
          {categories.map(category => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {category} 配置
                </CardTitle>
                <CardDescription>
                  {category === 'LDAP' && 'LDAP/Active Directory 连接配置'}
                  {category === '短信' && '阿里云短信服务配置'}
                  {category === 'OTP' && 'OTP二次验证配置'}
                  {category === '密码策略' && '密码强度和有效期策略'}
                  {category === '提醒' && '密码到期提醒配置'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/4">配置项</TableHead>
                      <TableHead className="w-1/3">值</TableHead>
                      <TableHead>说明</TableHead>
                      <TableHead>最后修改</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs
                      .filter(c => c.category === category)
                      .map(config => (
                        <TableRow key={config.key}>
                          <TableCell className="font-medium font-mono text-sm">
                            {config.key.split('.')[1]}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {config.value.includes('***') ? (
                              <span className="text-muted-foreground">{config.value}</span>
                            ) : (
                              <Badge variant="outline">{config.value}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {config.description}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">{config.lastModified}</span>
                              <span className="text-muted-foreground">by {config.modifiedBy}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(config)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReset(config)}
                              >
                                <RotateCcw className="w-4 h-4" />
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
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="outline">LDAP</Badge>
                <div>
                  <p className="text-sm font-medium">ldap.server</p>
                  <p className="text-xs text-muted-foreground">
                    修改前: ldap://192.168.1.9:389 → 修改后: ldap://192.168.1.10:389
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">2026-01-15 10:00:00</p>
                <p className="text-xs text-muted-foreground">by admin</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="outline">密码策略</Badge>
                <div>
                  <p className="text-sm font-medium">password.expiry_days</p>
                  <p className="text-xs text-muted-foreground">
                    修改前: 60 → 修改后: 90
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">2026-01-01 09:00:00</p>
                <p className="text-xs text-muted-foreground">by admin</p>
              </div>
            </div>
          </div>
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
              <div className="space-y-2">
                <Label>说明</Label>
                <Textarea value={selectedConfig.description} disabled rows={2} />
              </div>
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
