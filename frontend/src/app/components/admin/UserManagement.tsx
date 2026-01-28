import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Switch } from '@/app/components/ui/switch';
import { UserPlus, Search, Edit, Trash2, Key, Upload, Download, CheckCircle } from 'lucide-react';
import { mockUsers, mockOUs, type User } from '@/app/utils/mockData';
import { toast } from 'sonner';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOU, setFilterOU] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    ou: '',
    mustChangePassword: true,
  });

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOU = filterOU === 'all' || user.ou === filterOU;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

    return matchesSearch && matchesOU && matchesStatus;
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: String(users.length + 1),
      ...formData,
      status: 'active',
      passwordExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: '-',
    };
    setUsers([...users, newUser]);
    setShowAddUser(false);
    setFormData({
      username: '',
      name: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      ou: '',
      mustChangePassword: true,
    });
    toast.success('用户创建成功');
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...formData } : u));
    setShowEditUser(false);
    setSelectedUser(null);
    toast.success('用户信息已更新');
  };

  const handleToggleStatus = (userId: string) => {
    setUsers(users.map(u => 
      u.id === userId 
        ? { ...u, status: u.status === 'active' ? 'disabled' : 'active' as 'active' | 'disabled' }
        : u
    ));
    toast.success('用户状态已更新');
  };

  const handleResetPassword = (user: User) => {
    setUsers(users.map(u => 
      u.id === user.id 
        ? { ...u, mustChangePassword: true }
        : u
    ));
    toast.success(`已重置 ${user.name} 的密码`);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('确定要删除此用户吗？')) {
      setUsers(users.filter(u => u.id !== userId));
      toast.success('用户已删除');
    }
  };

  const handleExport = () => {
    const csv = [
      ['用户名', '姓名', '邮箱', '手机号', '部门', '岗位', 'OU', '状态'].join(','),
      ...filteredUsers.map(u => [
        u.username, u.name, u.email, u.phone, u.department, u.position, u.ou, u.status
      ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'users.csv';
    link.click();
    toast.success('导出成功');
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      department: user.department,
      position: user.position,
      ou: user.ou,
      mustChangePassword: user.mustChangePassword,
    });
    setShowEditUser(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">用户管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理系统用户，共 {users.length} 个用户
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
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
                    <Label htmlFor="add-email">邮箱 *</Label>
                    <Input
                      id="add-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-phone">手机号 *</Label>
                    <Input
                      id="add-phone"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-department">部门 *</Label>
                    <Input
                      id="add-department"
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-position">岗位 *</Label>
                    <Input
                      id="add-position"
                      required
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="add-ou">组织单元 (OU) *</Label>
                    <Select value={formData.ou} onValueChange={(v) => setFormData({ ...formData, ou: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择OU" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockOUs.map(ou => (
                          <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="add-must-change">首次登录强制改密</Label>
                      <Switch
                        id="add-must-change"
                        checked={formData.mustChangePassword}
                        onCheckedChange={(checked) => setFormData({ ...formData, mustChangePassword: checked })}
                      />
                    </div>
                  </div>
                </div>
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
          <SelectTrigger className="w-48">
            <SelectValue placeholder="筛选OU" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部OU</SelectItem>
            {mockOUs.map(ou => (
              <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
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
              <TableHead>密码到期</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  未找到用户
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>{user.position}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {mockOUs.find(ou => ou.id === user.ou)?.name || user.ou}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.status === 'active'}
                        onCheckedChange={() => handleToggleStatus(user.id)}
                      />
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                        {user.status === 'active' ? '正常' : '禁用'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{user.passwordExpiry}</span>
                      {user.mustChangePassword && (
                        <Badge variant="destructive" className="text-xs">需改密</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetPassword(user)}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUser(user.id)}
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
                <Input
                  id="edit-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled
                />
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
                <Select value={formData.ou} onValueChange={(v) => setFormData({ ...formData, ou: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mockOUs.map(ou => (
                      <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
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