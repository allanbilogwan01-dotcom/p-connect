import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  UserPlus, Search, Camera, QrCode, Check, 
  Edit, RefreshCw, CreditCard, X, Plus,
  Download, Scan, Loader2, Link2, ChevronRight, Upload, FileSpreadsheet, History, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  getVisitors, createVisitor, updateVisitor, createAuditLog, 
  saveBiometric, getBiometricByVisitorId, getPDLs, 
  createPDLVisitorLink, getPDLVisitorLinks, getVisitSessions
} from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { VisitorIDCard } from '@/components/IDCard';
import { useFaceDetection, descriptorToArray } from '@/hooks/useFaceDetection';
import { useCameraDevices } from '@/components/CameraSelector';
import { RELATIONSHIP_LABELS, CATEGORY_LABELS } from '@/types';
import { exportVisitorsToExcel, parseVisitorsFromExcel, downloadVisitorTemplate, calculateAge } from '@/lib/excelUtils';
import type { Visitor, RelationshipType, VisitorCategory } from '@/types';

export default function VisitorEnrollmentPage() {
  const [visitors, setVisitors] = useState<Visitor[]>(getVisitors());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showQR, setShowQR] = useState<Visitor | null>(null);
  const [showIDCard, setShowIDCard] = useState<Visitor | null>(null);
  const [showHistory, setShowHistory] = useState<Visitor | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // Enhanced enrollment states
  const [enrollmentStep, setEnrollmentStep] = useState<'info' | 'biometric' | 'link'>('info');
  const [enrollingBiometrics, setEnrollingBiometrics] = useState(false);
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  const [newVisitorId, setNewVisitorId] = useState<string | null>(null);
  const [skipBiometrics, setSkipBiometrics] = useState(false);
  
  // PDL Link states - support multiple links
  const [pdlLinks, setPdlLinks] = useState<{pdlId: string; relationship: RelationshipType; category: VisitorCategory}[]>([]);
  const [linkPDL, setLinkPDL] = useState('');
  const [linkRelationship, setLinkRelationship] = useState<RelationshipType | ''>('');
  const [linkCategory, setLinkCategory] = useState<VisitorCategory | ''>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const idCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const { isLoaded, isLoading: faceLoading, loadModels, detectFace } = useFaceDetection();
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();
  const pdls = getPDLs();

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    date_of_birth: '',
    gender: 'male' as 'male' | 'female',
    contact_number: '',
    address: '',
    valid_id_type: '',
    valid_id_number: '',
  });

  const filteredVisitors = visitors.filter(visitor => {
    const matchesSearch = 
      `${visitor.first_name} ${visitor.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitor.visitor_code.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || visitor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
          : { facingMode: 'user', width: 640, height: 480 }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setShowCamera(true);
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    if (showCamera && selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId, showCamera, startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setEnrollingBiometrics(false);
  }, []);

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

  const startBiometricEnrollment = useCallback(async (visitorId: string) => {
    if (!isLoaded) {
      toast({ title: 'Loading', description: 'Face detection is loading...' });
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: 640, height: 480 }
          : { facingMode: 'user', width: 640, height: 480 }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEnrollingBiometrics(true);
      setCapturedEmbeddings([]);
      setBiometricProgress(0);
      
      runEnrollmentCapture(visitorId);
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera for biometric enrollment.',
        variant: 'destructive',
      });
    }
  }, [isLoaded, selectedDeviceId, toast]);

  const runEnrollmentCapture = async (visitorId: string) => {
    if (!videoRef.current || !isLoaded) return;

    const detection = await detectFace(videoRef.current);
    
    if (detection) {
      const embedding = descriptorToArray(detection.descriptor);
      
      setCapturedEmbeddings(prev => {
        const newEmbeddings = [...prev, embedding];
        const progress = (newEmbeddings.length / 5) * 100;
        setBiometricProgress(progress);
        
        if (newEmbeddings.length >= 5) {
          saveBiometric(visitorId, newEmbeddings, newEmbeddings.map(() => 0.9));
          stopCamera();
          
          createAuditLog({
            user_id: user?.id || '',
            action: 'visitor_enrolled',
            target_type: 'visitor',
            target_id: visitorId,
          });
          
          toast({
            title: 'Biometrics Enrolled',
            description: 'Face recognition data has been saved successfully.',
          });
          
          // Move to link step
          setEnrollmentStep('link');
          
          return newEmbeddings;
        }
        
        setTimeout(() => runEnrollmentCapture(visitorId), 500);
        return newEmbeddings;
      });
    } else {
      if (enrollingBiometrics) {
        setTimeout(() => runEnrollmentCapture(visitorId), 200);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Transform text to uppercase (except for specific fields)
    const uppercaseFormData = {
      ...formData,
      first_name: formData.first_name.toUpperCase(),
      middle_name: formData.middle_name.toUpperCase(),
      last_name: formData.last_name.toUpperCase(),
      suffix: formData.suffix.toUpperCase(),
      address: formData.address.toUpperCase(),
      valid_id_type: formData.valid_id_type.toUpperCase(),
      valid_id_number: formData.valid_id_number.toUpperCase(),
    };
    
    if (editingVisitor) {
      const updated = updateVisitor(editingVisitor.id, {
        ...uppercaseFormData,
        photo_url: capturedPhoto || editingVisitor.photo_url,
      });
      if (updated) {
        setVisitors(getVisitors());
        createAuditLog({
          user_id: user?.id || '',
          action: 'visitor_updated',
          target_type: 'visitor',
          target_id: updated.id,
        });
        toast({ title: 'Visitor Updated', description: `${updated.first_name} ${updated.last_name} has been updated.` });
      }
      resetForm();
    } else {
      const newVisitor = createVisitor({ 
        ...uppercaseFormData, 
        status: 'active',
        photo_url: capturedPhoto || undefined,
      });
      setNewVisitorId(newVisitor.id);
      setVisitors(getVisitors());
      createAuditLog({
        user_id: user?.id || '',
        action: 'visitor_created',
        target_type: 'visitor',
        target_id: newVisitor.id,
      });
      toast({ 
        title: 'Visitor Created', 
        description: `${newVisitor.first_name} ${newVisitor.last_name} registered with ID: ${newVisitor.visitor_code}` 
      });
      
      // Move to biometric step
      setEnrollmentStep('biometric');
    }
  };

  const handleSkipBiometrics = () => {
    setSkipBiometrics(true);
    setEnrollmentStep('link');
  };

  const handleAddLink = () => {
    if (!linkPDL || !linkRelationship || !linkCategory) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if already added locally
    if (pdlLinks.some(l => l.pdlId === linkPDL)) {
      toast({
        title: 'Already Added',
        description: 'This PDL is already in the list.',
        variant: 'destructive',
      });
      return;
    }
    
    setPdlLinks(prev => [...prev, { pdlId: linkPDL, relationship: linkRelationship, category: linkCategory }]);
    setLinkPDL('');
    setLinkRelationship('');
    setLinkCategory('');
    
    toast({
      title: 'Link Added',
      description: 'PDL added to link list. Add more or finish.',
    });
  };

  const handleRemoveLink = (pdlId: string) => {
    setPdlLinks(prev => prev.filter(l => l.pdlId !== pdlId));
  };

  const handleFinishWithLinks = () => {
    if (!newVisitorId) {
      resetForm();
      return;
    }

    const existingLinks = getPDLVisitorLinks();
    
    for (const link of pdlLinks) {
      if (existingLinks.some(l => l.pdl_id === link.pdlId && l.visitor_id === newVisitorId)) {
        continue; // Skip if already exists
      }
      
      const newLink = createPDLVisitorLink({
        pdl_id: link.pdlId,
        visitor_id: newVisitorId,
        relationship: link.relationship,
        category: link.category,
        approval_status: 'pending',
      });
      
      createAuditLog({
        user_id: user?.id || '',
        action: 'kin_dalaw_created',
        target_type: 'pdl_visitor_link',
        target_id: newLink.id,
      });
    }
    
    if (pdlLinks.length > 0) {
      toast({
        title: 'Links Created',
        description: `${pdlLinks.length} PDL link(s) created and pending approval.`,
      });
    }
    
    resetForm();
  };

  const handleSkipLink = () => {
    handleFinishWithLinks();
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      middle_name: '',
      last_name: '',
      suffix: '',
      date_of_birth: '',
      gender: 'male',
      contact_number: '',
      address: '',
      valid_id_type: '',
      valid_id_number: '',
    });
    setEditingVisitor(null);
    setCapturedPhoto(null);
    setEnrollmentStep('info');
    setNewVisitorId(null);
    setSkipBiometrics(false);
    setPdlLinks([]);
    setLinkPDL('');
    setLinkRelationship('');
    setLinkCategory('');
    setCapturedEmbeddings([]);
    setBiometricProgress(0);
    stopCamera();
    setIsDialogOpen(false);
  };

  const handleEdit = (visitor: Visitor) => {
    setEditingVisitor(visitor);
    setFormData({
      first_name: visitor.first_name,
      middle_name: visitor.middle_name || '',
      last_name: visitor.last_name,
      suffix: visitor.suffix || '',
      date_of_birth: visitor.date_of_birth,
      gender: visitor.gender,
      contact_number: visitor.contact_number,
      address: visitor.address,
      valid_id_type: visitor.valid_id_type || '',
      valid_id_number: visitor.valid_id_number || '',
    });
    setCapturedPhoto(visitor.photo_url || null);
    setIsDialogOpen(true);
  };

  const handlePrintID = () => {
    if (!idCardRef.current) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Visitor ID Card</title>
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

  const hasBiometrics = (visitorId: string) => {
    return !!getBiometricByVisitorId(visitorId);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="status-active">ACTIVE</Badge>;
      case 'blacklisted':
        return <Badge className="status-rejected">BLACKLISTED</Badge>;
      case 'inactive':
        return <Badge className="status-detained">INACTIVE</Badge>;
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const relationshipOptions: RelationshipType[] = [
    'spouse', 'wife', 'husband', 'live_in_partner', 'common_law_partner',
    'parent', 'child', 'sibling', 'grandparent', 'grandchild',
    'aunt_uncle', 'cousin', 'niece_nephew', 'legal_guardian', 'close_friend', 'other'
  ];

  const categoryOptions: VisitorCategory[] = ['immediate_family', 'legal_guardian', 'close_friend'];

  const handleExportExcel = () => {
    exportVisitorsToExcel(visitors);
    toast({ title: 'EXPORT COMPLETE', description: 'Visitor masterlist exported to Excel.' });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const importedVisitors = await parseVisitorsFromExcel(file);
      let importedCount = 0;
      
      for (const visitorData of importedVisitors) {
        if (visitorData.first_name && visitorData.last_name && visitorData.date_of_birth) {
          createVisitor({
            first_name: visitorData.first_name,
            middle_name: visitorData.middle_name,
            last_name: visitorData.last_name,
            suffix: visitorData.suffix,
            date_of_birth: visitorData.date_of_birth,
            gender: visitorData.gender || 'male',
            contact_number: visitorData.contact_number || '',
            address: visitorData.address || '',
            valid_id_type: visitorData.valid_id_type,
            valid_id_number: visitorData.valid_id_number,
            status: 'active',
          });
          importedCount++;
        }
      }
      
      setVisitors(getVisitors());
      toast({ 
        title: 'IMPORT COMPLETE', 
        description: `${importedCount} visitor records imported successfully.` 
      });
    } catch (error) {
      toast({ 
        title: 'IMPORT ERROR', 
        description: 'Failed to parse Excel file. Please check the format.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getVisitorHistory = (visitorId: string) => {
    const sessions = getVisitSessions();
    return sessions
      .filter(s => s.visitor_id === visitorId)
      .sort((a, b) => new Date(b.time_in).getTime() - new Date(a.time_in).getTime());
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
            <UserPlus className="w-8 h-8 text-primary" />
            Visitor Enrollment
          </h1>
          <p className="text-muted-foreground mt-1">
            Register and manage visitor records with biometric enrollment
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadVisitorTemplate} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            TEMPLATE
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="gap-2">
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            IMPORT
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportExcel}
            className="hidden"
          />
          <Button variant="outline" onClick={handleExportExcel} className="gap-2">
            <Download className="w-4 h-4" />
            EXPORT
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="btn-scanner">
            <Plus className="w-5 h-5 mr-2" />
            Enroll Visitor
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
                placeholder="Search by name or visitor code..."
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
                <SelectItem value="active">ACTIVE</SelectItem>
                <SelectItem value="blacklisted">BLACKLISTED</SelectItem>
                <SelectItem value="inactive">INACTIVE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Visitor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVisitors.length === 0 ? (
          <div className="col-span-full">
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <UserPlus className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No visitors found</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredVisitors.map((visitor) => (
            <Card key={visitor.id} className="glass-card overflow-hidden group">
              <CardContent className="p-0">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {visitor.photo_url ? (
                    <img 
                      src={visitor.photo_url} 
                      alt={`${visitor.first_name} ${visitor.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-muted-foreground/30">
                        {visitor.first_name.charAt(0)}{visitor.last_name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    {hasBiometrics(visitor.id) && (
                      <Badge className="bg-success/80 text-success-foreground text-xs">
                        <Scan className="w-3 h-3 mr-1" />
                        ENROLLED
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    {statusBadge(visitor.status)}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleEdit(visitor)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setShowQR(visitor)}>
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setShowIDCard(visitor)}>
                        <CreditCard className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setShowHistory(visitor)}>
                        <History className="w-4 h-4" />
                      </Button>
                      {!hasBiometrics(visitor.id) && (
                        <Button 
                          size="sm" 
                          className="bg-primary/80"
                          onClick={() => {
                            setNewVisitorId(visitor.id);
                            setEnrollmentStep('biometric');
                            setIsDialogOpen(true);
                          }}
                          disabled={faceLoading}
                        >
                          <Scan className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-foreground truncate uppercase">
                    {visitor.last_name}, {visitor.first_name}
                  </p>
                  <p className="text-sm font-mono text-primary mt-1">
                    ID: {visitor.visitor_code}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {visitor.contact_number}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Enhanced Enrollment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-3xl glass-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-primary" />
              {editingVisitor ? 'Edit Visitor' : 'Enroll New Visitor'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Step Indicator */}
          {!editingVisitor && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${enrollmentStep === 'info' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">1</span>
                INFO
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${enrollmentStep === 'biometric' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">2</span>
                BIOMETRIC
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${enrollmentStep === 'link' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">3</span>
                PDL LINK
              </div>
            </div>
          )}
          
          {/* Step 1: Basic Info */}
          {(enrollmentStep === 'info' || editingVisitor) && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Capture */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-48 h-48 rounded-2xl overflow-hidden bg-muted border-2 border-dashed border-border relative">
                  {showCamera ? (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : capturedPhoto ? (
                    <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-12 h-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                
                {/* Camera Selector */}
                {devices.length > 1 && showCamera && (
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <Camera className="w-3 h-3 mr-1" />
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device, idx) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                <div className="flex gap-2">
                  {showCamera ? (
                    <>
                      <Button type="button" onClick={capturePhoto} className="btn-scanner">
                        <Check className="w-4 h-4 mr-2" />
                        Capture
                      </Button>
                      <Button type="button" variant="outline" onClick={stopCamera}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="secondary" onClick={() => startCamera()}>
                        <Camera className="w-4 h-4 mr-2" />
                        {capturedPhoto ? 'Retake' : 'Take Photo'}
                      </Button>
                      {capturedPhoto && (
                        <Button type="button" variant="outline" onClick={() => setCapturedPhoto(null)}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value.toUpperCase() }))}
                    className="input-field uppercase"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Middle Name</Label>
                  <Input
                    value={formData.middle_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, middle_name: e.target.value.toUpperCase() }))}
                    className="input-field uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value.toUpperCase() }))}
                    className="input-field uppercase"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Suffix</Label>
                  <Input
                    value={formData.suffix}
                    onChange={(e) => setFormData(prev => ({ ...prev, suffix: e.target.value.toUpperCase() }))}
                    className="input-field uppercase"
                    placeholder="JR., SR., III, etc."
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
                      <SelectItem value="male">MALE</SelectItem>
                      <SelectItem value="female">FEMALE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact Number *</Label>
                  <Input
                    value={formData.contact_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_number: e.target.value }))}
                    className="input-field"
                    placeholder="+63 XXX XXX XXXX"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valid ID Type</Label>
                  <Input
                    value={formData.valid_id_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, valid_id_type: e.target.value.toUpperCase() }))}
                    className="input-field uppercase"
                    placeholder="e.g., DRIVER'S LICENSE"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address *</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value.toUpperCase() }))}
                    className="input-field uppercase"
                    placeholder="Complete address"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valid ID Number</Label>
                  <Input
                    value={formData.valid_id_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, valid_id_number: e.target.value.toUpperCase() }))}
                    className="input-field uppercase"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-scanner">
                  {editingVisitor ? 'Update Visitor' : 'Continue to Biometrics'}
                  {!editingVisitor && <ChevronRight className="w-4 h-4 ml-2" />}
                </Button>
              </DialogFooter>
            </form>
          )}
          
          {/* Step 2: Biometric Enrollment */}
          {enrollmentStep === 'biometric' && !editingVisitor && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Facial Biometric Enrollment</h3>
                <p className="text-sm text-muted-foreground">
                  Capture face data for visitor identification
                </p>
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-80 h-80 rounded-2xl overflow-hidden bg-muted border-2 border-primary/30">
                  {faceLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
                      <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                      <p className="text-sm text-muted-foreground">Loading face detection...</p>
                    </div>
                  )}
                  
                  {enrollingBiometrics ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                      <div className="absolute inset-8 border-2 border-primary/50 rounded-xl pointer-events-none">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-xl" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Scan className="w-16 h-16 text-muted-foreground/50 mb-4" />
                      <p className="text-sm text-muted-foreground">Ready for biometric capture</p>
                    </div>
                  )}
                </div>
                
                {/* Camera Selector for Biometrics */}
                {devices.length > 1 && (
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger className="w-64 h-9 text-sm">
                      <Camera className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device, idx) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {enrollingBiometrics && (
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Capturing face data...</span>
                      <span className="text-primary font-mono">{Math.round(biometricProgress)}%</span>
                    </div>
                    <Progress value={biometricProgress} className="h-2" />
                  </div>
                )}
              </div>
              
              <div className="flex justify-center gap-3">
                {!enrollingBiometrics ? (
                  <>
                    <Button 
                      onClick={() => newVisitorId && startBiometricEnrollment(newVisitorId)}
                      className="btn-scanner"
                      disabled={faceLoading || !newVisitorId}
                    >
                      <Scan className="w-4 h-4 mr-2" />
                      Start Enrollment
                    </Button>
                    <Button variant="outline" onClick={handleSkipBiometrics}>
                      Skip for Now
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Step 3: PDL Link */}
          {enrollmentStep === 'link' && !editingVisitor && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Link to PDL(s)</h3>
                <p className="text-sm text-muted-foreground">
                  Add one or more PDL links for this visitor
                </p>
              </div>

              {/* Added Links List */}
              {pdlLinks.length > 0 && (
                <div className="space-y-2 max-w-md mx-auto">
                  <Label className="text-sm">Added Links ({pdlLinks.length})</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pdlLinks.map(link => {
                      const pdl = pdls.find(p => p.id === link.pdlId);
                      return (
                        <div key={link.pdlId} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div>
                            <p className="text-sm font-medium">{pdl?.last_name}, {pdl?.first_name}</p>
                            <p className="text-xs text-muted-foreground">{link.relationship.replace(/_/g, ' ')}</p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveLink(link.pdlId)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label>Select PDL</Label>
                  <Select value={linkPDL} onValueChange={setLinkPDL}>
                    <SelectTrigger className="input-field">
                      <SelectValue placeholder="Select a PDL" />
                    </SelectTrigger>
                    <SelectContent>
                      {pdls.filter(p => p.status === 'detained' && !pdlLinks.some(l => l.pdlId === p.id)).map(pdl => (
                        <SelectItem key={pdl.id} value={pdl.id}>
                          {pdl.last_name}, {pdl.first_name} ({pdl.pdl_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Select value={linkRelationship} onValueChange={(v) => setLinkRelationship(v as RelationshipType)}>
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
                  <Label>Category</Label>
                  <Select value={linkCategory} onValueChange={(v) => setLinkCategory(v as VisitorCategory)}>
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

                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleAddLink}
                  disabled={!linkPDL || !linkRelationship || !linkCategory}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another PDL Link
                </Button>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button 
                  onClick={handleFinishWithLinks}
                  className="btn-scanner"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {pdlLinks.length > 0 ? `Finish with ${pdlLinks.length} Link(s)` : 'Skip & Finish'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
        <DialogContent className="sm:max-w-sm glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">VISITOR QR CODE</DialogTitle>
          </DialogHeader>
          {showQR && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG 
                  value={showQR.visitor_code} 
                  size={200}
                  level="H"
                />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground uppercase">
                  {showQR.first_name} {showQR.last_name}
                </p>
                <p className="font-mono text-primary text-lg">{showQR.visitor_code}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ID Card Dialog */}
      <Dialog open={!!showIDCard} onOpenChange={() => setShowIDCard(null)}>
        <DialogContent className="sm:max-w-md glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl">VISITOR ID CARD</DialogTitle>
          </DialogHeader>
          {showIDCard && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div ref={idCardRef}>
                  <VisitorIDCard visitor={showIDCard} />
                </div>
              </div>
              <div className="flex gap-2">
                {!hasBiometrics(showIDCard.id) && (
                  <Button 
                    onClick={() => { 
                      setShowIDCard(null); 
                      setNewVisitorId(showIDCard.id);
                      setEnrollmentStep('biometric');
                      setIsDialogOpen(true);
                    }}
                    variant="secondary"
                    className="flex-1"
                    disabled={faceLoading}
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Enroll Face
                  </Button>
                )}
                <Button onClick={handlePrintID} className="flex-1 btn-scanner">
                  <Download className="w-4 h-4 mr-2" />
                  Print ID
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Visit History Dialog */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="sm:max-w-lg glass-card border-border max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <History className="w-6 h-6 text-primary" />
              VISIT HISTORY
            </DialogTitle>
          </DialogHeader>
          {showHistory && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                {showHistory.photo_url ? (
                  <img src={showHistory.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {showHistory.first_name.charAt(0)}{showHistory.last_name.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold uppercase">{showHistory.last_name}, {showHistory.first_name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{showHistory.visitor_code}</p>
                </div>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {getVisitorHistory(showHistory.id).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No visit history found</p>
                  </div>
                ) : (
                  getVisitorHistory(showHistory.id).map((session) => {
                    const pdl = pdls.find(p => p.id === session.pdl_id);
                    const duration = session.time_out 
                      ? Math.round((new Date(session.time_out).getTime() - new Date(session.time_in).getTime()) / 60000)
                      : null;
                    return (
                      <div key={session.id} className="p-3 rounded-lg bg-muted/20 border border-border/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              Visited: <span className="text-primary">{pdl?.last_name}, {pdl?.first_name}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.time_in).toLocaleDateString()} at {new Date(session.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={session.visit_type === 'conjugal' ? 'status-approved' : 'status-active'}>
                              {session.visit_type}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {duration !== null ? `${duration} min` : 'Ongoing'}
                            </p>
                          </div>
                        </div>
                        {session.time_out && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Out: {new Date(session.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Total visits: <span className="text-foreground font-semibold">{getVisitorHistory(showHistory.id).length}</span>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
