import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Link2, Plus, Search, Check, X, 
  MoreHorizontal, Eye, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  getPDLVisitorLinks, createPDLVisitorLink, updatePDLVisitorLink,
  getPDLs, getVisitors, createAuditLog 
} from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { RELATIONSHIP_LABELS, CATEGORY_LABELS } from '@/types';
import type { PDLVisitorLink, RelationshipType, VisitorCategory } from '@/types';

export default function KinDalawPage() {
  const [links, setLinks] = useState<PDLVisitorLink[]>(getPDLVisitorLinks());
  const [pdls] = useState(getPDLs());
  const [visitors] = useState(getVisitors());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PDLVisitorLink | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    pdl_id: '',
    visitor_id: '',
    relationship: '' as RelationshipType,
    category: '' as VisitorCategory,
  });

  const getEnrichedLinks = () => {
    return links.map(link => ({
      ...link,
      pdl: pdls.find(p => p.id === link.pdl_id),
      visitor: visitors.find(v => v.id === link.visitor_id),
    }));
  };

  const filteredLinks = getEnrichedLinks().filter(link => {
    const pdlName = link.pdl ? `${link.pdl.first_name} ${link.pdl.last_name}` : '';
    const visitorName = link.visitor ? `${link.visitor.first_name} ${link.visitor.last_name}` : '';
    const matchesSearch = 
      pdlName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || link.approval_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if link already exists
    const existingLink = links.find(l => 
      l.pdl_id === formData.pdl_id && l.visitor_id === formData.visitor_id
    );
    
    if (existingLink) {
      toast({
        title: 'Link Exists',
        description: 'This visitor is already linked to this PDL.',
        variant: 'destructive',
      });
      return;
    }

    const newLink = createPDLVisitorLink({
      ...formData,
      approval_status: 'pending',
    });
    
    setLinks(getPDLVisitorLinks());
    createAuditLog({
      user_id: user?.id || '',
      action: 'kin_dalaw_created',
      target_type: 'pdl_visitor_link',
      target_id: newLink.id,
    });
    
    toast({ 
      title: 'Kin Dalaw Created', 
      description: 'The link has been created and is pending approval.' 
    });
    resetForm();
  };

  const handleApproval = (approved: boolean) => {
    if (!selectedLink) return;
    
    const updates: Partial<PDLVisitorLink> = {
      approval_status: approved ? 'approved' : 'rejected',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    };
    
    if (!approved && rejectionReason) {
      updates.rejection_reason = rejectionReason;
    }
    
    updatePDLVisitorLink(selectedLink.id, updates);
    setLinks(getPDLVisitorLinks());
    
    createAuditLog({
      user_id: user?.id || '',
      action: approved ? 'kin_dalaw_approved' : 'kin_dalaw_rejected',
      target_type: 'pdl_visitor_link',
      target_id: selectedLink.id,
    });
    
    toast({
      title: approved ? 'Link Approved' : 'Link Rejected',
      description: approved 
        ? 'The visitor can now visit this PDL.'
        : 'The link request has been rejected.',
    });
    
    setSelectedLink(null);
    setIsApprovalDialogOpen(false);
    setRejectionReason('');
  };

  const resetForm = () => {
    setFormData({
      pdl_id: '',
      visitor_id: '',
      relationship: '' as RelationshipType,
      category: '' as VisitorCategory,
    });
    setIsDialogOpen(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="status-pending">Pending</Badge>;
      case 'approved':
        return <Badge className="status-approved">Approved</Badge>;
      case 'rejected':
        return <Badge className="status-rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const relationshipOptions: RelationshipType[] = [
    'spouse', 'wife', 'husband', 'live_in_partner', 'common_law_partner',
    'parent', 'child', 'sibling', 'grandparent', 'grandchild',
    'aunt_uncle', 'cousin', 'niece_nephew', 'legal_guardian', 'close_friend', 'other'
  ];

  const categoryOptions: VisitorCategory[] = ['immediate_family', 'legal_guardian', 'close_friend'];

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
            <Link2 className="w-8 h-8 text-primary" />
            Kin Dalaw Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Link visitors to PDLs and manage approval workflow
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="btn-scanner">
          <Plus className="w-5 h-5 mr-2" />
          Create Link
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {links.filter(l => l.approval_status === 'pending').length}
              </p>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <Check className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {links.filter(l => l.approval_status === 'approved').length}
              </p>
              <p className="text-sm text-muted-foreground">Approved Links</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {links.filter(l => l.approval_status === 'rejected').length}
              </p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by PDL or visitor name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-field"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] input-field">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
                  <th>PDL</th>
                  <th>Visitor</th>
                  <th>Relationship</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Link2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No links found</p>
                    </td>
                  </tr>
                ) : (
                  filteredLinks.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <div>
                          <p className="font-medium text-foreground">
                            {link.pdl?.last_name}, {link.pdl?.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {link.pdl?.pdl_code}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-foreground">
                            {link.visitor?.last_name}, {link.visitor?.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {link.visitor?.visitor_code}
                          </p>
                        </div>
                      </td>
                      <td>{RELATIONSHIP_LABELS[link.relationship]}</td>
                      <td>{CATEGORY_LABELS[link.category]}</td>
                      <td>{statusBadge(link.approval_status)}</td>
                      <td className="text-sm text-muted-foreground">
                        {new Date(link.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {link.approval_status === 'pending' && hasPermission('approve_kin_dalaw') && (
                              <>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedLink(link);
                                  setIsApprovalDialogOpen(true);
                                }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Review
                                </DropdownMenuItem>
                              </>
                            )}
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

      {/* Create Link Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-lg glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Link2 className="w-6 h-6 text-primary" />
              Create Kin Dalaw Link
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select PDL *</Label>
                <Select value={formData.pdl_id} onValueChange={(val) => setFormData(prev => ({ ...prev, pdl_id: val }))}>
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select a PDL" />
                  </SelectTrigger>
                  <SelectContent>
                    {pdls.filter(p => p.status === 'detained').map(pdl => (
                      <SelectItem key={pdl.id} value={pdl.id}>
                        {pdl.last_name}, {pdl.first_name} ({pdl.pdl_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Select Visitor *</Label>
                <Select value={formData.visitor_id} onValueChange={(val) => setFormData(prev => ({ ...prev, visitor_id: val }))}>
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select a visitor" />
                  </SelectTrigger>
                  <SelectContent>
                    {visitors.filter(v => v.status === 'active').map(visitor => (
                      <SelectItem key={visitor.id} value={visitor.id}>
                        {visitor.last_name}, {visitor.first_name} ({visitor.visitor_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Relationship *</Label>
                <Select value={formData.relationship} onValueChange={(val: RelationshipType) => setFormData(prev => ({ ...prev, relationship: val }))}>
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map(rel => (
                      <SelectItem key={rel} value={rel}>
                        {RELATIONSHIP_LABELS[rel]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(val: VisitorCategory) => setFormData(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="btn-scanner"
                disabled={!formData.pdl_id || !formData.visitor_id || !formData.relationship || !formData.category}
              >
                Create Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectedLink(null);
          setRejectionReason('');
        }
        setIsApprovalDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl">Review Kin Dalaw Request</DialogTitle>
          </DialogHeader>
          
          {selectedLink && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">PDL</p>
                  <p className="font-medium text-foreground">
                    {pdls.find(p => p.id === selectedLink.pdl_id)?.first_name}{' '}
                    {pdls.find(p => p.id === selectedLink.pdl_id)?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Visitor</p>
                  <p className="font-medium text-foreground">
                    {visitors.find(v => v.id === selectedLink.visitor_id)?.first_name}{' '}
                    {visitors.find(v => v.id === selectedLink.visitor_id)?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Relationship</p>
                  <p className="font-medium text-foreground">
                    {RELATIONSHIP_LABELS[selectedLink.relationship]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">
                    {CATEGORY_LABELS[selectedLink.category]}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="input-field"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsApprovalDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleApproval(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => handleApproval(true)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
