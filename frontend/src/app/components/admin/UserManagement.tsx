import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Switch } from '@/app/components/ui/switch';
import { UserPlus, Search, Edit, Trash2, Key, Download, RefreshCw } from 'lucide-react';
import { userApi, ouApi, type User, type OU } from '@/app/utils/api';
import { toast } from 'sonner';

type ViewUser = User & {
  ouDn?: string;
  enabled?: boolean;
};

const getOuDnFromDn = (dn?: string): string => {
  if (!dn) return '';
  const parts = dn.split(',');
  parts.shift();
  return parts.join(',');
};

export function UserManagement() {
  const [users, setUsers] = useState<ViewUser[]>([]);
  const [ous, setOus] = useState<OU[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOU, setFilterOU] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ViewUser | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    ou: '',
    password: '',
    mustChangePassword: true,
  });
  const [selectedUserOu, setSelectedUserOu] = useState('');
  const [editOuQuery, setEditOuQuery] = useState('');
  const [ouMatchHint, setOuMatchHint] = useState('');

  const loadOus = async () => {
    try {
      const res = await ouApi.list();
      setOus(res.items || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: { q?: string; ou?: string; status?: string; page?: number; pageSize?: number } = {
        page,
        pageSize,
      };
      if (searchTerm.trim()) params.q = searchTerm.trim();
      if (filterOU !== 'all' && filterOU) params.ou = filterOU;
      if (filterStatus === 'active') params.status = 'enabled';
      if (filterStatus === 'disabled') params.status = 'disabled';
      const res = await userApi.list(params);
      const items = (res.items || []).map((u) => ({
        ...u,
        ouDn: getOuDnFromDn(u.dn),
        enabled:
          typeof u.enabled === 'boolean'
            ? u.enabled
            : filterStatus === 'active'
            ? true
            : filterStatus === 'disabled'
            ? false
            : undefined,
      }));
      setUsers(items);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || '加载用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOus();
  }, []);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      loadUsers();
    }
  }, [searchTerm, filterOU, filterStatus, pageSize]);

  useEffect(() => {
    loadUsers();
  }, [page]);

  const ouOptions = useMemo(() => {
    return ous.map((o) => ({
      dn: o.dn,
      label: o.name ? `${o.name} (${o.dn})` : o.dn,
    }));
  }, [ous]);

  const filteredOuOptions = useMemo(() => {
    const query = editOuQuery.trim().toLowerCase();
    if (!query) return ouOptions;
    return ouOptions.filter((o) => o.label.toLowerCase().includes(query) || o.dn.toLowerCase().includes(query));
  }, [ouOptions, editOuQuery]);

  useEffect(() => {
    const query = editOuQuery.trim();
    if (!query) {
      setOuMatchHint('');
      return;
    }
    if (filteredOuOptions.length === 1) {
      setFormData((prev) => ({ ...prev, ou: filteredOuOptions[0].dn }));
      setOuMatchHint('已自动匹配到唯一 OU');
      return;
    }
    if (filteredOuOptions.length > 1) {
      setOuMatchHint(`匹配到 ${filteredOuOptions.length} 个 OU，请从列表中选择一个`);
      return;
    }
    setOuMatchHint('未匹配到 OU，请调整关键字');
  }, [editOuQuery, filteredOuOptions.length]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = useMemo(() => users, [users]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password.trim()) {
      setError('请填写初始密码');
      return;
    }
    if (!formData.ou) {
      setError('请选择 OU');
      return;
    }
    try {
      await userApi.create({
        sAMAccountName: formData.username,
        displayName: formData.name,
        ouDn: formData.ou,
        password: formData.password,
        mail: formData.email,
        mobile: formData.phone,
        department: formData.department,
        title: formData.position,
        forceChangeAtFirstLogin: formData.mustChangePassword,
      });
      toast.success('用户创建成功');
      setShowAddUser(false);
      setFormData({
        username: '',
        name: '',
        email: '',
        phone: '',
        department: '',
        position: '',
        ou: '',
        password: '',
        mustChangePassword: true,
      });
      await loadUsers();
    } catch (err: any) {
      setError(err.message || '创建用户失败');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await userApi.update(selectedUser.sAMAccountName, {
        displayName: formData.name,
        mail: formData.email,
        mobile: formData.phone,
        department: formData.department,
        title: formData.position,
      });

      if (formData.ou && formData.ou !== selectedUserOu) {
        await userApi.move(selectedUser.sAMAccountName, formData.ou);
      }

      toast.success('用户信息已更新');
      setShowEditUser(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || '更新失败');
    }
  };

  const handleToggleStatus = async (user: ViewUser, enabled: boolean) => {
    try {
      await userApi.setStatus(user.sAMAccountName, enabled);
      toast.success('用户状态已更新');
      setUsers((prev) =>
        prev.map((u) => (u.sAMAccountName === user.sAMAccountName ? { ...u, enabled } : u))
      );
    } catch (err: any) {
      toast.error(err.message || '更新状态失败');
    }
  };

  const handleResetPassword = async (user: ViewUser) => {
    const newPassword = prompt('请输入新密码');
    if (!newPassword) return;
    try {
      await userApi.resetPassword(user.sAMAccountName, newPassword, true);
      toast.success(`已重置 ${user.displayName || user.sAMAccountName} 的密码`);
    } catch (err: any) {
      toast.error(err.message || '重置密码失败');
    }
  };

  const handleDeleteUser = async (user: ViewUser) => {
    if (!confirm('确定要删除此用户吗？')) return;
    try {
      await userApi.delete(user.sAMAccountName);
      toast.success('用户已删除');
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
  };

  const handleExport = async () => {
    try {
      const params: { q?: string; ou?: string; status?: string } = {};
      if (searchTerm.trim()) params.q = searchTerm.trim();
      if (filterOU !== 'all' && filterOU) params.ou = filterOU;
      if (filterStatus === 'active') params.status = 'enabled';
      if (filterStatus === 'disabled') params.status = 'disabled';
      const csv = await userApi.export(params);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'users.csv';
      link.click();
      toast.success('导出成功');
    } catch (err: any) {
      toast.error(err.message || '导出失败');
    }
  };

  const openEditDialog = (user: ViewUser) => {
    const ouDn = user.ouDn || '';
    setSelectedUser(user);
    setSelectedUserOu(ouDn);
    setEditOuQuery('');
    setFormData({
      username: user.sAMAccountName,
      name: user.displayName || '',
      email: user.mail || '',
      phone: user.mobile || '',
      department: user.department || '',
      position: user.title || '',
      ou: ouDn,
      password: '',
      mustChangePassword: true,
    });
    setShowEditUser(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">用户管理</h2>
          <p className="text-sm text-muted-foreground mt-1">管理系统用户</p>
          <p className="text-sm text-muted-foreground">共 {total} 个用户</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" onClick={loadUsers} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => setShowAddUser(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            新增用户
          </Button>
          <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>新增用户</DialogTitle>
                <DialogDescription>填写用户信息以创建新用户</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-username">用户名 *</Label>
                    <Input
                      id="add-username"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-name">姓名 *</Label>
                    <Input
                      id="add-name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-email">邮箱</Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-phone">手机号</Label>
                    <Input
                      id="add-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-department">部门</Label>
                    <Input
                      id="add-department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-position">岗位</Label>
                    <Input
                      id="add-position"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="add-ou">组织单元 (OU) *</Label>
                    <Select value={formData.ou} onValueChange={(v) => setFormData({ ...formData, ou: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择 OU" />
                      </SelectTrigger>
                      <SelectContent>
                        {ouOptions.map((ou) => (
                          <SelectItem key={ou.dn} value={ou.dn}>
                            {ou.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="add-password">初始密码 *</Label>
                    <Input
                      id="add-password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Switch
                      checked={formData.mustChangePassword}
                      onCheckedChange={(checked) => setFormData({ ...formData, mustChangePassword: checked })}
                    />
                    <Label>首次登录必须改密</Label>
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddUser(false)}>
                    取消
                  </Button>
                  <Button type="submit">创建用户</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名、姓名、邮箱、手机号、部门..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterOU} onValueChange={setFilterOU}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="筛选OU" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部OU</SelectItem>
            {ouOptions.map((ou) => (
              <SelectItem key={ou.dn} value={ou.dn}>
                {ou.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">正常</SelectItem>
            <SelectItem value="disabled">禁用</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadUsers}>
          <Search className="w-4 h-4 mr-2" />
          查询
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {total} 条
        </div>
        <div className="flex items-center gap-3">
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
          <div className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                >
                  首页
                </Button>
                {currentPage > 2 && (
                  <span className="text-muted-foreground text-sm">…</span>
                )}
                {Array.from({ length: Math.min(3, totalPages) }, (_, idx) => {
                  const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
                  const pageNumber = start + idx;
                  return (
                    <Button
                      key={pageNumber}
                      variant={pageNumber === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
                {currentPage < totalPages - 1 && (
                  <span className="text-muted-foreground text-sm">…</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  末页
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label>跳转</Label>
            <Input
              value={String(currentPage)}
              onChange={(e) => {
                const val = e.target.value.replace(/\\D/g, '');
                const num = val ? Number(val) : 1;
                setPage(Math.min(totalPages, Math.max(1, num)));
              }}
              className="w-20"
            />
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
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>岗位</TableHead>
              <TableHead>OU</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  正在加载...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  未找到用户
                </TableCell>
              </TableRow>
            ) : (
              pagedUsers.map((user) => (
                <TableRow key={user.sAMAccountName}>
                  <TableCell className="font-medium">{user.sAMAccountName}</TableCell>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell className="text-sm">{user.mail}</TableCell>
                  <TableCell>{user.mobile}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>{user.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.ouDn || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.enabled ?? true}
                        disabled={typeof user.enabled !== 'boolean'}
                        onCheckedChange={(checked) => handleToggleStatus(user, checked)}
                      />
                      {typeof user.enabled === 'boolean' ? (
                        <Badge variant={user.enabled ? 'default' : 'secondary'}>
                          {user.enabled ? '正常' : '禁用'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">未知</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleResetPassword(user)}>
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(user)}>
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
      <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户信息</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">用户名</Label>
                <Input id="edit-username" value={formData.username} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">姓名</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">邮箱</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">手机号</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-department">部门</Label>
                <Input
                  id="edit-department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-position">岗位</Label>
                <Input
                  id="edit-position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-ou">组织单元 (OU)</Label>
                <Input
                  placeholder="输入部门/OU 名称或 DN 过滤"
                  value={editOuQuery}
                  onChange={(e) => setEditOuQuery(e.target.value)}
                />
                {ouMatchHint && (
                  <div className="text-xs text-muted-foreground">{ouMatchHint}</div>
                )}
                <Select value={formData.ou} onValueChange={(v) => setFormData({ ...formData, ou: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredOuOptions.map((ou) => (
                      <SelectItem key={ou.dn} value={ou.dn}>
                        {ou.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditUser(false)}>
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
