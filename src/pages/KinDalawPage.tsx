import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Link2, Search, Check, X, 
  MoreHorizontal, Eye, Clock, Users
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
  getPDLVisitorLinks, updatePDLVisitorLink,
  getPDLs, getVisitors, createAuditLog 
} from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { RELATIONSHIP_LABELS, CATEGORY_LABELS } from '@/types';
import type { PDLVisitorLink } from '@/types';

export default function KinDalawPage() {
  const [links, setLinks] = useState<PDLVisitorLink[]>(getPDLVisitorLinks());
  const [pdls] = useState(getPDLs());
  const [visitors] = useState(getVisitors());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PDLVisitorLink | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

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
      title: approved ? 'LINK APPROVED' : 'LINK REJECTED',
      description: approved 
        ? 'The visitor can now visit this PDL.'
        : 'The link request has been rejected.',
    });
    
    setSelectedLink(null);
    setIsApprovalDialogOpen(false);
    setRejectionReason('');
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="status-pending">PENDING</Badge>;
      case 'approved':
        return <Badge className="status-approved">APPROVED</Badge>;
      case 'rejected':
        return <Badge className="status-rejected">REJECTED</Badge>;
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const stats = {
    pending: links.filter(l => l.approval_status === 'pending').length,
    approved: links.filter(l => l.approval_status === 'approved').length,
    rejected: links.filter(l => l.approval_status === 'rejected').length,
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
            <Link2 className="w-8 h-8 text-primary" />
            KIN DALAW MANAGEMENT
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage PDL-Visitor link approvals (Create links via Visitor Enrollment)
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">PENDING APPROVAL</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <Check className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.approved}</p>
              <p className="text-sm text-muted-foreground">APPROVED LINKS</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.rejected}</p>
              <p className="text-sm text-muted-foreground">REJECTED</p>
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
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                className="pl-10 input-field uppercase"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] input-field">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ALL STATUS</SelectItem>
                <SelectItem value="pending">PENDING</SelectItem>
                <SelectItem value="approved">APPROVED</SelectItem>
                <SelectItem value="rejected">REJECTED</SelectItem>
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
                  <th>VISITOR</th>
                  <th>RELATIONSHIP</th>
                  <th>CATEGORY</th>
                  <th>STATUS</th>
                  <th>CREATED</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">NO LINKS FOUND</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create links via Visitor Enrollment page
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLinks.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <div>
                          <p className="font-medium text-foreground uppercase">
                            {link.pdl?.last_name}, {link.pdl?.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {link.pdl?.pdl_code}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-foreground uppercase">
                            {link.visitor?.last_name}, {link.visitor?.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {link.visitor?.visitor_code}
                          </p>
                        </div>
                      </td>
                      <td className="uppercase">{RELATIONSHIP_LABELS[link.relationship]}</td>
                      <td className="uppercase">{CATEGORY_LABELS[link.category]}</td>
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
                              <DropdownMenuItem onClick={() => {
                                setSelectedLink(link);
                                setIsApprovalDialogOpen(true);
                              }}>
                                <Eye className="w-4 h-4 mr-2" />
                                REVIEW
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              VIEW DETAILS
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
            <DialogTitle className="text-xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-primary" />
              REVIEW KIN DALAW REQUEST
            </DialogTitle>
          </DialogHeader>
          
          {selectedLink && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">PDL</Label>
                  <p className="font-medium uppercase">
                    {pdls.find(p => p.id === selectedLink.pdl_id)?.last_name}, {pdls.find(p => p.id === selectedLink.pdl_id)?.first_name}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">VISITOR</Label>
                  <p className="font-medium uppercase">
                    {visitors.find(v => v.id === selectedLink.visitor_id)?.last_name}, {visitors.find(v => v.id === selectedLink.visitor_id)?.first_name}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">RELATIONSHIP</Label>
                  <p className="font-medium uppercase">{RELATIONSHIP_LABELS[selectedLink.relationship]}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">CATEGORY</Label>
                  <p className="font-medium uppercase">{CATEGORY_LABELS[selectedLink.category]}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>REJECTION REASON (IF REJECTING)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value.toUpperCase())}
                  placeholder="ENTER REASON FOR REJECTION..."
                  className="input-field uppercase"
                />
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => handleApproval(true)}
                  className="flex-1 bg-success hover:bg-success/90"
                >
                  <Check className="w-4 h-4 mr-2" />
                  APPROVE
                </Button>
                <Button 
                  onClick={() => handleApproval(false)}
                  variant="destructive"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  REJECT
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
