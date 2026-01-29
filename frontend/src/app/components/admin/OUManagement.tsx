import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { FolderPlus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { ouApi, configApi, type OU } from '@/app/utils/api';
import { toast } from 'sonner';

type ViewOU = OU & { parentDn?: string };

const getParentDn = (dn: string): string => {
  const parts = dn.split(',');
  parts.shift();
  return parts.join(',');
};

export function OUManagement() {
  const [ous, setOus] = useState<ViewOU[]>([]);
  const [baseDn, setBaseDn] = useState('');
  const [showAddOU, setShowAddOU] = useState(false);
  const [showEditOU, setShowEditOU] = useState(false);
  const [selectedOU, setSelectedOU] = useState<ViewOU | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parentDn: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);

  const loadConfig = async () => {
    try {
      const cfg = await configApi.list();
      if (cfg.LDAP_BASE_DN) setBaseDn(cfg.LDAP_BASE_DN);
    } catch (err) {
      // ignore
    }
  };

  const loadOus = async () => {
    setIsLoading(true);
    try {
      const res = await ouApi.list();
      const items = (res.items || []).map((o) => ({
        ...o,
        parentDn: getParentDn(o.dn),
      }));
      setOus(items);
    } catch (err: any) {
      toast.error(err.message || '加载OU失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadOus();
  }, []);

  const ouOptions = useMemo(() => {
    return ous.map((o) => ({
      dn: o.dn,
      label: o.name ? `${o.name} (${o.dn})` : o.dn,
    }));
  }, [ous]);

  const filteredOus = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return ous;
    return ous.filter((o) => {
      const name = (o.name || '').toLowerCase();
      const dn = (o.dn || '').toLowerCase();
      const desc = (o.description || '').toLowerCase();
      return name.includes(query) || dn.includes(query) || desc.includes(query);
    });
  }, [ous, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredOus.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOus = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOus.slice(start, start + pageSize);
  }, [filteredOus, currentPage, pageSize]);

  const handleAddOU = async (e: React.FormEvent) => {
    e.preventDefault();
    const parentDn = formData.parentDn || baseDn;
    if (!parentDn) {
      toast.error('请设置父 OU 或配置 LDAP_BASE_DN');
      return;
    }
    try {
      await ouApi.create({
        name: formData.name,
        parentDn,
        description: formData.description,
      });
      toast.success('OU 创建成功');
      setShowAddOU(false);
      setFormData({ name: '', parentDn: '', description: '' });
      await loadOus();
    } catch (err: any) {
      toast.error(err.message || '创建OU失败');
    }
  };

  const handleEditOU = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOU) return;
    try {
      await ouApi.update({
        dn: selectedOU.dn,
        name: formData.name || undefined,
        description: formData.description || undefined,
      });
      toast.success('OU 信息已更新');
      setShowEditOU(false);
      setSelectedOU(null);
      await loadOus();
    } catch (err: any) {
      toast.error(err.message || '更新OU失败');
    }
  };

  const handleDeleteOU = async (ou: ViewOU) => {
    if (!confirm('确定要删除此OU吗？')) return;
    try {
      await ouApi.delete(ou.dn);
      toast.success('OU 已删除');
      await loadOus();
    } catch (err: any) {
      toast.error(err.message || '删除OU失败');
    }
  };

  const openEditDialog = (ou: ViewOU) => {
    setSelectedOU(ou);
    setFormData({
      name: ou.name || '',
      parentDn: ou.parentDn || '',
      description: ou.description || '',
    });
    setShowEditOU(true);
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadOus} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => setShowAddOU(true)}>
            <FolderPlus className="w-4 h-4 mr-2" />
            新增OU
          </Button>
        </div>
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
                <Select value={formData.parentDn} onValueChange={(v) => setFormData({ ...formData, parentDn: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={baseDn ? `默认根：${baseDn}` : '无（根OU）'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无（根OU）</SelectItem>
                    {ouOptions.map((ou) => (
                      <SelectItem key={ou.dn} value={ou.dn}>
                        {ou.label}
                      </SelectItem>
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

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索 OU 名称 / DN / 描述"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex items-center gap-2">
          <Label>每页</Label>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          第 {currentPage} / {totalPages} 页
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          下一页
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OU名称</TableHead>
              <TableHead>DN</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  正在加载...
                </TableCell>
              </TableRow>
            ) : filteredOus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  暂无OU
                </TableCell>
              </TableRow>
            ) : (
              pagedOus.map((ou) => (
                <TableRow key={ou.dn}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {ou.parentDn && <span className="text-muted-foreground">└─</span>}
                      {ou.name || ou.dn}
                      {!ou.parentDn && <Badge variant="outline">根OU</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ou.dn}</TableCell>
                  <TableCell className="text-sm">{ou.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(ou)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteOU(ou)}>
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
