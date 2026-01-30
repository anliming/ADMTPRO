import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { FolderPlus, Edit, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { ouApi, configApi, userApi, type OU, type User } from '@/app/utils/api';
import { toast } from 'sonner';

type ViewOU = OU & { parentDn?: string };

const getParentDn = (dn: string): string => {
  const parts = dn.split(',');
  parts.shift();
  return parts.join(',');
};

export function OUManagement({ onRequireOtp }: { onRequireOtp?: () => Promise<void> }) {
  const [ous, setOus] = useState<ViewOU[]>([]);
  const [baseDn, setBaseDn] = useState('');
  const [showAddOU, setShowAddOU] = useState(false);
  const [showEditOU, setShowEditOU] = useState(false);
  const [selectedOU, setSelectedOU] = useState<ViewOU | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ViewOU | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    parentDn: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showOuUsers, setShowOuUsers] = useState(false);
  const [ouUsers, setOuUsers] = useState<User[]>([]);
  const [ouUsersTotal, setOuUsersTotal] = useState(0);
  const [ouUsersPage, setOuUsersPage] = useState(1);
  const [ouUsersPageSize, setOuUsersPageSize] = useState(15);
  const [ouUsersLoading, setOuUsersLoading] = useState(false);

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

  const loadOuUsers = async (ouDn: string) => {
    setOuUsersLoading(true);
    try {
      const res = await userApi.list({ ou: ouDn, page: ouUsersPage, pageSize: ouUsersPageSize });
      setOuUsers(res.items || []);
      setOuUsersTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || '加载OU用户失败');
    } finally {
      setOuUsersLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadOus();
  }, []);

  useEffect(() => {
    if (showOuUsers && selectedOU) {
      loadOuUsers(selectedOU.dn);
    }
  }, [showOuUsers, selectedOU, ouUsersPage, ouUsersPageSize]);

  const ouOptions = useMemo(() => {
    return ous.map((o) => ({
      dn: o.dn,
      label: o.name ? `${o.name} (${o.dn})` : o.dn,
    }));
  }, [ous]);

  const childrenMap = useMemo(() => {
    const map: Record<string, ViewOU[]> = {};
    ous.forEach((ou) => {
      const parent = ou.parentDn || '';
      if (!map[parent]) map[parent] = [];
      map[parent].push(ou);
    });
    Object.values(map).forEach((items) => {
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });
    return map;
  }, [ous]);

  const rootOus = useMemo(() => {
    if (baseDn) {
      return childrenMap[baseDn] || [];
    }
    const dnSet = new Set(ous.map((ou) => ou.dn));
    return ous.filter((ou) => !dnSet.has(ou.parentDn || ''));
  }, [baseDn, childrenMap, ous]);

  const flattenedOus = useMemo(() => {
    const items: Array<{ ou: ViewOU; depth: number; hasChildren: boolean }> = [];
    const visit = (ou: ViewOU, depth: number) => {
      const children = childrenMap[ou.dn] || [];
      const hasChildren = children.length > 0;
      items.push({ ou, depth, hasChildren });
      if (hasChildren && expanded[ou.dn]) {
        children.forEach((child) => visit(child, depth + 1));
      }
    };
    rootOus.forEach((ou) => visit(ou, 0));
    return items;
  }, [childrenMap, expanded, rootOus]);

  const handleToggleOu = (ou: ViewOU, hasChildren: boolean) => {
    if (hasChildren) {
      setExpanded((prev) => ({ ...prev, [ou.dn]: !prev[ou.dn] }));
      return;
    }
    setSelectedOU(ou);
    setOuUsersPage(1);
    setShowOuUsers(true);
  };

  const withOtpRetry = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (err: any) {
      if (err?.code === 'OTP_REQUIRED' && onRequireOtp) {
        await onRequireOtp();
        return await action();
      }
      throw err;
    }
  };

  const handleAddOU = async (e: React.FormEvent) => {
    e.preventDefault();
    const parentDn = formData.parentDn || baseDn;
    if (!parentDn) {
      toast.error('请设置父 OU 或配置 LDAP_BASE_DN');
      return;
    }
    try {
      await withOtpRetry(() =>
        ouApi.create({
          name: formData.name,
          parentDn,
          description: formData.description,
        }),
      );
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
      await withOtpRetry(() =>
        ouApi.update({
          dn: selectedOU.dn,
          name: formData.name || undefined,
          description: formData.description || undefined,
        }),
      );
      toast.success('OU 信息已更新');
      setShowEditOU(false);
      setSelectedOU(null);
      await loadOus();
    } catch (err: any) {
      toast.error(err.message || '更新OU失败');
    }
  };

  const handleDeleteOU = async (ou: ViewOU) => {
    setDeleteTarget(ou);
    setShowDeleteDialog(true);
  };

  const confirmDeleteOU = async () => {
    if (!deleteTarget) return;
    try {
      await withOtpRetry(() => ouApi.delete(deleteTarget.dn));
      toast.success('OU 已删除');
      setShowDeleteDialog(false);
      setDeleteTarget(null);
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

  const ouUsersTotalPages = Math.max(1, Math.ceil(ouUsersTotal / ouUsersPageSize));
  const ouUsersCurrentPage = Math.min(ouUsersPage, ouUsersTotalPages);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">OU管理</h2>
          <p className="text-sm text-muted-foreground mt-1">管理组织单元 (Organizational Unit)</p>
          <p className="text-sm text-muted-foreground">共 {ous.length} 个OU</p>
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

      <div className="text-sm text-muted-foreground">
        点击OU展开下级，点击末级OU查看用户。
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
            ) : ous.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  暂无OU
                </TableCell>
              </TableRow>
            ) : (
              flattenedOus.map(({ ou, depth, hasChildren }) => (
                <TableRow
                  key={ou.dn}
                  className="cursor-pointer"
                  onClick={() => handleToggleOu(ou, hasChildren)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
                      {hasChildren ? (
                        expanded[ou.dn] ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                      <span>{ou.name || ou.dn}</span>
                      {baseDn && ou.parentDn === baseDn && <Badge variant="outline">顶级OU</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ou.dn}</TableCell>
                  <TableCell className="text-sm">{ou.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(ou);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOU(ou);
                        }}
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除 OU</DialogTitle>
            <DialogDescription>
              确认删除 {deleteTarget?.name || deleteTarget?.dn || ''} 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteOU}>
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOuUsers} onOpenChange={setShowOuUsers}>
        <DialogContent className="max-w-5xl w-[200vw]">
          <DialogHeader>
            <DialogTitle>OU 用户列表</DialogTitle>
            <DialogDescription>
              {selectedOU?.name || selectedOU?.dn || ''} 的用户
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>共 {ouUsersTotal} 个用户</span>
            <div className="flex flex-wrap items-center gap-2 md:justify-end md:max-w-[420px]">
              <Label>每页</Label>
              <Select
                value={String(ouUsersPageSize)}
                onValueChange={(v) => {
                  setOuUsersPageSize(Number(v));
                  setOuUsersPage(1);
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>
                第 {ouUsersCurrentPage} / {ouUsersTotalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                className="px-2"
                onClick={() => setOuUsersPage(Math.max(1, ouUsersCurrentPage - 1))}
                disabled={ouUsersCurrentPage <= 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="px-2"
                onClick={() => setOuUsersPage(Math.min(ouUsersTotalPages, ouUsersCurrentPage + 1))}
                disabled={ouUsersCurrentPage >= ouUsersTotalPages}
              >
                下一页
              </Button>
            </div>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>手机号</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ouUsersLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      正在加载...
                    </TableCell>
                  </TableRow>
                ) : ouUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      暂无用户
                    </TableCell>
                  </TableRow>
                ) : (
                  ouUsers.map((user) => (
                    <TableRow key={user.sAMAccountName}>
                      <TableCell>{user.sAMAccountName}</TableCell>
                      <TableCell>{user.displayName || '-'}</TableCell>
                      <TableCell>{user.mail || '-'}</TableCell>
                      <TableCell>{user.mobile || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
