import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { FolderPlus, Edit, Trash2, Users } from 'lucide-react';
import { mockOUs, type OU } from '@/app/utils/mockData';
import { toast } from 'sonner';

export function OUManagement() {
  const [ous, setOUs] = useState<OU[]>(mockOUs);
  const [showAddOU, setShowAddOU] = useState(false);
  const [showEditOU, setShowEditOU] = useState(false);
  const [selectedOU, setSelectedOU] = useState<OU | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    description: '',
  });

  const handleAddOU = (e: React.FormEvent) => {
    e.preventDefault();
    const newOU: OU = {
      id: `ou${ous.length + 1}`,
      ...formData,
      parentId: formData.parentId || null,
      userCount: 0,
    };
    setOUs([...ous, newOU]);
    setShowAddOU(false);
    setFormData({ name: '', parentId: '', description: '' });
    toast.success('OU创建成功');
  };

  const handleEditOU = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOU) return;
    
    setOUs(ous.map(ou => 
      ou.id === selectedOU.id 
        ? { ...ou, ...formData, parentId: formData.parentId || null }
        : ou
    ));
    setShowEditOU(false);
    setSelectedOU(null);
    toast.success('OU信息已更新');
  };

  const handleDeleteOU = (ouId: string) => {
    const hasChildren = ous.some(ou => ou.parentId === ouId);
    const ou = ous.find(o => o.id === ouId);
    
    if (hasChildren) {
      toast.error('无法删除：该OU下还有子OU');
      return;
    }
    
    if (ou && ou.userCount > 0) {
      toast.error(`无法删除：该OU下还有 ${ou.userCount} 个用户`);
      return;
    }
    
    if (confirm('确定要删除此OU吗？')) {
      setOUs(ous.filter(ou => ou.id !== ouId));
      toast.success('OU已删除');
    }
  };

  const openEditDialog = (ou: OU) => {
    setSelectedOU(ou);
    setFormData({
      name: ou.name,
      parentId: ou.parentId || '',
      description: ou.description,
    });
    setShowEditOU(true);
  };

  const getOUPath = (ouId: string): string => {
    const ou = ous.find(o => o.id === ouId);
    if (!ou) return '';
    if (!ou.parentId) return ou.name;
    return `${getOUPath(ou.parentId)} / ${ou.name}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">OU管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理组织单元 (Organizational Unit)，共 {ous.length} 个OU
          </p>
        </div>
        <Button onClick={() => setShowAddOU(true)}>
          <FolderPlus className="w-4 h-4 mr-2" />
          新增OU
        </Button>
        <Dialog open={showAddOU} onOpenChange={setShowAddOU}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增OU</DialogTitle>
              <DialogDescription>创建新的组织单元</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOU} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-ou-name">OU名称 *</Label>
                <Input
                  id="add-ou-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：技术部"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-parent">父OU</Label>
                <Select value={formData.parentId} onValueChange={(v) => setFormData({ ...formData, parentId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="无（根OU）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无（根OU）</SelectItem>
                    {ous.map(ou => (
                      <SelectItem key={ou.id} value={ou.id}>{getOUPath(ou.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-description">描述</Label>
                <Textarea
                  id="add-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="OU的职责描述"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddOU(false)}>
                  取消
                </Button>
                <Button type="submit">创建OU</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tree View */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OU名称</TableHead>
              <TableHead>完整路径</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>用户数</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ous.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  暂无OU
                </TableCell>
              </TableRow>
            ) : (
              ous.map(ou => (
                <TableRow key={ou.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {ou.parentId && <span className="text-muted-foreground">└─</span>}
                      {ou.name}
                      {!ou.parentId && <Badge variant="outline">根OU</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getOUPath(ou.id)}
                  </TableCell>
                  <TableCell className="text-sm">{ou.description}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{ou.userCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(ou)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteOU(ou.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditOU} onOpenChange={setShowEditOU}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑OU</DialogTitle>
            <DialogDescription>修改组织单元信息</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditOU} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-ou-name">OU名称</Label>
              <Input
                id="edit-ou-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parent">父OU</Label>
              <Select value={formData.parentId} onValueChange={(v) => setFormData({ ...formData, parentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="无（根OU）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">无（根OU）</SelectItem>
                  {ous
                    .filter(ou => ou.id !== selectedOU?.id) // 不能选择自己作为父OU
                    .map(ou => (
                      <SelectItem key={ou.id} value={ou.id}>{getOUPath(ou.id)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">描述</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditOU(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}