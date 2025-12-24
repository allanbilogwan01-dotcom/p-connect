import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Users, Plus, Search, MoreHorizontal, 
  Check, X, Edit, UserCog, Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getUsers, updateUser, createUser, setPassword, createAuditLog } from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import type { User, UserRole, UserStatus } from '@/types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'guest', label: 'Guest' },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(getUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState<User | null>(null);
  const [showDisableDialog, setShowDisableDialog] = useState<User | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'staff' as UserRole,
    password: '',
  });

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
      const updated = updateUser(editingUser.id, {
        username: formData.username,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
      });
      if (updated) {
        setUsers(getUsers());
        createAuditLog({
          user_id: currentUser?.id || '',
          action: 'role_changed',
          target_type: 'user',
          target_id: updated.id,
          details: { new_role: formData.role },
        });
        toast({ title: 'User Updated', description: `${updated.full_name} has been updated.` });
      }
    } else {
      const newUser = createUser({
        username: formData.username,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        status: 'active',
      });
      setPassword(formData.username, formData.password);
      setUsers(getUsers());
      createAuditLog({
        user_id: currentUser?.id || '',
        action: 'user_created',
        target_type: 'user',
        target_id: newUser.id,
      });
      toast({ title: 'User Created', description: `${newUser.full_name} has been added.` });
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      role: 'staff',
      password: '',
    });
    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      password: '',
    });
    setIsDialogOpen(true);
  };

  const handleApprove = (user: User) => {
    updateUser(user.id, {
      status: 'active',
      approved_by: currentUser?.id,
      approved_at: new Date().toISOString(),
    });
    setUsers(getUsers());
    createAuditLog({
      user_id: currentUser?.id || '',
      action: 'user_approved',
      target_type: 'user',
      target_id: user.id,
    });
    toast({ title: 'User Approved', description: `${user.full_name} can now access the system.` });
    setShowApproveDialog(null);
  };

  const handleDisable = (user: User) => {
    updateUser(user.id, { status: 'disabled' });
    setUsers(getUsers());
    createAuditLog({
      user_id: currentUser?.id || '',
      action: 'user_disabled',
      target_type: 'user',
      target_id: user.id,
    });
    toast({ title: 'User Disabled', description: `${user.full_name} has been disabled.` });
    setShowDisableDialog(null);
  };

  const handleResetPassword = () => {
    if (showResetPassword && newPassword.length >= 6) {
      setPassword(showResetPassword.username, newPassword);
      toast({ title: 'Password Reset', description: `Password for ${showResetPassword.full_name} has been reset.` });
      setShowResetPassword(null);
      setNewPassword('');
    }
  };

  const statusBadge = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="status-approved">Active</Badge>;
      case 'pending':
        return <Badge className="status-pending">Pending</Badge>;
      case 'disabled':
        return <Badge className="status-rejected">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const roleBadge = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      super_admin: 'bg-primary/20 text-primary border-primary/30',
      admin: 'bg-info/20 text-info border-info/30',
      staff: 'bg-success/20 text-success border-success/30',
      guest: 'bg-muted/50 text-muted-foreground border-muted-foreground/30',
    };
    return (
      <Badge className={`${colors[role]} border capitalize`}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage system users and permissions
          </p>
        </div>
        <div className="flex gap-3">
          {pendingCount > 0 && (
            <Badge className="status-pending text-sm px-4 py-2">
              {pendingCount} Pending Approval
            </Badge>
          )}
          <Button onClick={() => setIsDialogOpen(true)} className="btn-scanner">
            <Plus className="w-5 h-5 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-field"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px] input-field">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[150px] input-field">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {user.full_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>{roleBadge(user.role)}</td>
                      <td>{statusBadge(user.status)}</td>
                      <td className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.status === 'pending' && (
                              <DropdownMenuItem onClick={() => setShowApproveDialog(user)}>
                                <Check className="w-4 h-4 mr-2 text-success" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowResetPassword(user)}>
                              <Key className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status !== 'disabled' && user.id !== currentUser?.id && (
                              <DropdownMenuItem 
                                onClick={() => setShowDisableDialog(user)}
                                className="text-destructive"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Disable
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-md glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <UserCog className="w-6 h-6 text-primary" />
              {editingUser ? 'Edit User' : 'Create New User'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="input-field"
                required
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formData.role} onValueChange={(val: UserRole) => setFormData(prev => ({ ...prev, role: val }))}>
                <SelectTrigger className="input-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="input-field"
                  required
                  minLength={6}
                />
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" className="btn-scanner">
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={!!showApproveDialog} onOpenChange={() => setShowApproveDialog(null)}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {showApproveDialog?.full_name}? 
              They will be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => showApproveDialog && handleApprove(showApproveDialog)}
              className="bg-success hover:bg-success/90"
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable Dialog */}
      <AlertDialog open={!!showDisableDialog} onOpenChange={() => setShowDisableDialog(null)}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable {showDisableDialog?.full_name}? 
              They will no longer be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => showDisableDialog && handleDisable(showDisableDialog)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showResetPassword} onOpenChange={() => { setShowResetPassword(null); setNewPassword(''); }}>
        <DialogContent className="sm:max-w-sm glass-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set a new password for {showResetPassword?.full_name}
            </p>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetPassword(null); setNewPassword(''); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={newPassword.length < 6}
              className="btn-scanner"
            >
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
