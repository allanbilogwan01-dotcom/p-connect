import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Plus, Search, Filter, MoreHorizontal, 
  Edit, Eye, Camera, Download, CreditCard, Check, RefreshCw
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
import { useToast } from '@/hooks/use-toast';
import { getPDLs, createPDL, updatePDL, createAuditLog } from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { PDLIDCard } from '@/components/IDCard';
import type { PDL } from '@/types';

export default function PDLMasterlistPage() {
  const [pdls, setPDLs] = useState<PDL[]>(getPDLs());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPDL, setEditingPDL] = useState<PDL | null>(null);
  const [viewingPDL, setViewingPDL] = useState<PDL | null>(null);
  const [showIDCard, setShowIDCard] = useState<PDL | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const idCardRef = useRef<HTMLDivElement>(null);
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const photoUrl = canvas.toDataURL('image/jpeg');
      setCapturedPhoto(photoUrl);
      stopCamera();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingPDL) {
      const updated = updatePDL(editingPDL.id, {
        ...formData,
        photo_url: capturedPhoto || editingPDL.photo_url,
      });
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
      const newPDL = createPDL({ 
        ...formData, 
        status: 'detained',
        photo_url: capturedPhoto || undefined,
      });
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
    setCapturedPhoto(null);
    stopCamera();
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
    setCapturedPhoto(pdl.photo_url || null);
    setIsDialogOpen(true);
  };

  const handlePrintID = () => {
    if (!idCardRef.current) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>PDL ID Card</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
              .card { transform: scale(1.5); }
            </style>
          </head>
          <body>
            <div class="card">${idCardRef.current.outerHTML}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
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
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {pdl.photo_url ? (
                              <img src={pdl.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-semibold text-muted-foreground">
                                {pdl.first_name.charAt(0)}{pdl.last_name.charAt(0)}
                              </span>
                            )}
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
                            <DropdownMenuItem onClick={() => setViewingPDL(pdl)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowIDCard(pdl)}>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Generate ID
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
        <DialogContent className="sm:max-w-2xl glass-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {editingPDL ? 'Edit PDL Record' : 'Add New PDL'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Capture */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-xl overflow-hidden bg-muted border-2 border-dashed border-border relative">
                {showCamera ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                ) : capturedPhoto ? (
                  <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {showCamera ? (
                  <>
                    <Button type="button" onClick={capturePhoto} className="btn-scanner" size="sm">
                      <Check className="w-4 h-4 mr-1" />
                      Capture
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={startCamera}>
                      <Camera className="w-4 h-4 mr-1" />
                      {capturedPhoto ? 'Retake' : 'Take Photo'}
                    </Button>
                    {capturedPhoto && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setCapturedPhoto(null)}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

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

      {/* View Details Dialog */}
      <Dialog open={!!viewingPDL} onOpenChange={() => setViewingPDL(null)}>
        <DialogContent className="sm:max-w-lg glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl">PDL Details</DialogTitle>
          </DialogHeader>
          {viewingPDL && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl bg-muted overflow-hidden">
                  {viewingPDL.photo_url ? (
                    <img src={viewingPDL.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                      {viewingPDL.first_name.charAt(0)}{viewingPDL.last_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    {viewingPDL.last_name}, {viewingPDL.first_name}
                  </h3>
                  <p className="font-mono text-primary">{viewingPDL.pdl_code}</p>
                  {statusBadge(viewingPDL.status)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date of Birth</p>
                  <p className="text-foreground">{new Date(viewingPDL.date_of_birth).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gender</p>
                  <p className="text-foreground capitalize">{viewingPDL.gender}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cell Location</p>
                  <p className="text-foreground">{viewingPDL.cell_block} - {viewingPDL.cell_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Commitment Date</p>
                  <p className="text-foreground">{new Date(viewingPDL.date_of_commit).toLocaleDateString()}</p>
                </div>
                {viewingPDL.crime && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Crime/Offense</p>
                    <p className="text-foreground">{viewingPDL.crime}</p>
                  </div>
                )}
              </div>
              <Button onClick={() => { setViewingPDL(null); setShowIDCard(viewingPDL); }} className="w-full">
                <CreditCard className="w-4 h-4 mr-2" />
                Generate ID Card
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ID Card Dialog */}
      <Dialog open={!!showIDCard} onOpenChange={() => setShowIDCard(null)}>
        <DialogContent className="sm:max-w-md glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl">PDL ID Card</DialogTitle>
          </DialogHeader>
          {showIDCard && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div ref={idCardRef}>
                  <PDLIDCard pdl={showIDCard} />
                </div>
              </div>
              <Button onClick={handlePrintID} className="w-full btn-scanner">
                <Download className="w-4 h-4 mr-2" />
                Print ID Card
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
