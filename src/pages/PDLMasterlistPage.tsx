import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Plus, Search, Filter, MoreHorizontal, 
  Edit, Eye, Trash2, Download 
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
import { useToast } from '@/hooks/use-toast';
import { getPDLs, createPDL, updatePDL, createAuditLog } from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import type { PDL } from '@/types';

export default function PDLMasterlistPage() {
  const [pdls, setPDLs] = useState<PDL[]>(getPDLs());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPDL, setEditingPDL] = useState<PDL | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    date_of_birth: '',
    gender: 'male' as 'male' | 'female',
    cell_block: '',
    cell_number: '',
    date_of_commit: '',
    crime: '',
  });

  const filteredPDLs = pdls.filter(pdl => {
    const matchesSearch = 
      `${pdl.first_name} ${pdl.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pdl.pdl_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pdl.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingPDL) {
      const updated = updatePDL(editingPDL.id, formData);
      if (updated) {
        setPDLs(getPDLs());
        createAuditLog({
          user_id: user?.id || '',
          action: 'pdl_updated',
          target_type: 'pdl',
          target_id: updated.id,
        });
        toast({ title: 'PDL Updated', description: `${updated.first_name} ${updated.last_name} has been updated.` });
      }
    } else {
      const newPDL = createPDL({ ...formData, status: 'detained' });
      setPDLs(getPDLs());
      createAuditLog({
        user_id: user?.id || '',
        action: 'pdl_created',
        target_type: 'pdl',
        target_id: newPDL.id,
      });
      toast({ title: 'PDL Added', description: `${newPDL.first_name} ${newPDL.last_name} has been registered with code ${newPDL.pdl_code}.` });
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      middle_name: '',
      last_name: '',
      suffix: '',
      date_of_birth: '',
      gender: 'male',
      cell_block: '',
      cell_number: '',
      date_of_commit: '',
      crime: '',
    });
    setEditingPDL(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (pdl: PDL) => {
    setEditingPDL(pdl);
    setFormData({
      first_name: pdl.first_name,
      middle_name: pdl.middle_name || '',
      last_name: pdl.last_name,
      suffix: pdl.suffix || '',
      date_of_birth: pdl.date_of_birth,
      gender: pdl.gender,
      cell_block: pdl.cell_block,
      cell_number: pdl.cell_number,
      date_of_commit: pdl.date_of_commit,
      crime: pdl.crime || '',
    });
    setIsDialogOpen(true);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'detained':
        return <Badge className="status-detained">Detained</Badge>;
      case 'released':
        return <Badge className="status-released">Released</Badge>;
      case 'transferred':
        return <Badge className="status-pending">Transferred</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
            <Users className="w-8 h-8 text-primary" />
            PDL Masterlist
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage Person Deprived of Liberty records
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="btn-scanner">
          <Plus className="w-5 h-5 mr-2" />
          Add New PDL
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by name or PDL code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-field"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] input-field">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="detained">Detained</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PDL Code</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Cell</th>
                  <th>Date of Commit</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPDLs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No PDL records found</p>
                    </td>
                  </tr>
                ) : (
                  filteredPDLs.map((pdl) => (
                    <tr key={pdl.id}>
                      <td>
                        <span className="font-mono text-primary font-medium">{pdl.pdl_code}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-semibold text-muted-foreground">
                              {pdl.first_name.charAt(0)}{pdl.last_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {pdl.last_name}, {pdl.first_name} {pdl.middle_name} {pdl.suffix}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              DOB: {new Date(pdl.date_of_birth).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="capitalize">{pdl.gender}</td>
                      <td>
                        <span className="text-sm">{pdl.cell_block} - {pdl.cell_number}</span>
                      </td>
                      <td>{new Date(pdl.date_of_commit).toLocaleDateString()}</td>
                      <td>{statusBadge(pdl.status)}</td>
                      <td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(pdl)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
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
        <DialogContent className="sm:max-w-2xl glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {editingPDL ? 'Edit PDL Record' : 'Add New PDL'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input
                  value={formData.middle_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, middle_name: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Suffix</Label>
                <Input
                  value={formData.suffix}
                  onChange={(e) => setFormData(prev => ({ ...prev, suffix: e.target.value }))}
                  className="input-field"
                  placeholder="Jr., Sr., III, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth *</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Gender *</Label>
                <Select value={formData.gender} onValueChange={(val: 'male' | 'female') => setFormData(prev => ({ ...prev, gender: val }))}>
                  <SelectTrigger className="input-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cell Block *</Label>
                <Input
                  value={formData.cell_block}
                  onChange={(e) => setFormData(prev => ({ ...prev, cell_block: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., Building A"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Cell Number *</Label>
                <Input
                  value={formData.cell_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, cell_number: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., 101"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Commitment *</Label>
                <Input
                  type="date"
                  value={formData.date_of_commit}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_commit: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Crime/Offense</Label>
                <Input
                  value={formData.crime}
                  onChange={(e) => setFormData(prev => ({ ...prev, crime: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., Theft"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" className="btn-scanner">
                {editingPDL ? 'Update PDL' : 'Add PDL'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
