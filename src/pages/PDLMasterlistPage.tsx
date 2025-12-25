import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Plus, Search, Filter, MoreHorizontal, 
  Edit, Eye, Camera, Download, CreditCard, Check, RefreshCw, Scan, Loader2, X
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { getPDLs, createPDL, updatePDL, createAuditLog, saveBiometric, getBiometricByVisitorId } from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { PDLIDCard } from '@/components/IDCard';
import { useCameraDevices } from '@/components/CameraSelector';
import { useFaceDetection, descriptorToArray } from '@/hooks/useFaceDetection';
import { useCameraContext } from '@/hooks/useCameraContext';
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
  
  // Biometric enrollment states
  const [enrollingBiometrics, setEnrollingBiometrics] = useState(false);
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const idCardRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();
  const { isLoaded, isLoading: faceLoading, loadModels, detectFace } = useFaceDetection();
  const { setActive: setCameraActive } = useCameraContext();

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
    date_of_commit: '',
    crimes: [] as string[],
    case_number: '',
    status: 'detained' as 'detained' | 'released' | 'transferred' | 'deceased',
  });
  
  const [newCrime, setNewCrime] = useState('');

  const filteredPDLs = pdls.filter(pdl => {
    const matchesSearch = 
      `${pdl.first_name} ${pdl.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pdl.pdl_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pdl.status === statusFilter;
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
      setCameraActive(true);
    } catch (error) {
      toast({
        title: 'CAMERA ERROR',
        description: 'Unable to access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, [toast, setCameraActive]);

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
    setCameraActive(false);
  }, [setCameraActive]);

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

  const startBiometricEnrollment = useCallback(async () => {
    if (!isLoaded) {
      toast({ title: 'LOADING', description: 'Face detection is loading...' });
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
      setShowCamera(true);
      setEnrollingBiometrics(true);
      setCapturedEmbeddings([]);
      setBiometricProgress(0);
      setCameraActive(true);
    } catch (error) {
      toast({
        title: 'CAMERA ERROR',
        description: 'Unable to access camera for biometric enrollment.',
        variant: 'destructive',
      });
    }
  }, [isLoaded, selectedDeviceId, toast, setCameraActive]);

  const runEnrollmentCapture = useCallback(async (pdlId: string) => {
    if (!videoRef.current || !isLoaded || !enrollingBiometrics) return;

    const detection = await detectFace(videoRef.current);
    
    if (detection) {
      const embedding = descriptorToArray(detection.descriptor);
      
      setCapturedEmbeddings(prev => {
        const newEmbeddings = [...prev, embedding];
        const progress = (newEmbeddings.length / 5) * 100;
        setBiometricProgress(progress);
        
        if (newEmbeddings.length >= 5) {
          // Save biometrics using PDL ID as visitor_id (they share biometric storage)
          saveBiometric(pdlId, newEmbeddings, newEmbeddings.map(() => 0.9));
          stopCamera();
          
          toast({
            title: 'BIOMETRICS ENROLLED',
            description: 'Face recognition data has been saved successfully.',
          });
          
          return newEmbeddings;
        }
        
        setTimeout(() => runEnrollmentCapture(pdlId), 500);
        return newEmbeddings;
      });
    } else {
      if (enrollingBiometrics) {
        setTimeout(() => runEnrollmentCapture(pdlId), 200);
      }
    }
  }, [isLoaded, enrollingBiometrics, detectFace, stopCamera, toast]);

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
        toast({ title: 'PDL UPDATED', description: `${updated.first_name} ${updated.last_name} has been updated.` });
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
      toast({ title: 'PDL ADDED', description: `${newPDL.first_name} ${newPDL.last_name} has been registered with code ${newPDL.pdl_code}.` });
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
      date_of_commit: '',
      crimes: [],
      case_number: '',
      status: 'detained',
    });
    setEditingPDL(null);
    setCapturedPhoto(null);
    setCapturedEmbeddings([]);
    setBiometricProgress(0);
    setNewCrime('');
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
      date_of_commit: pdl.date_of_commit,
      crimes: pdl.crimes || [],
      case_number: pdl.case_number || '',
      status: pdl.status,
    });
    setCapturedPhoto(pdl.photo_url || null);
    setIsDialogOpen(true);
  };
  
  const addCrime = () => {
    if (newCrime.trim()) {
      setFormData(prev => ({ ...prev, crimes: [...prev.crimes, newCrime.trim().toUpperCase()] }));
      setNewCrime('');
    }
  };
  
  const removeCrime = (index: number) => {
    setFormData(prev => ({ ...prev, crimes: prev.crimes.filter((_, i) => i !== index) }));
  };
  
  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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

  const hasBiometrics = (pdlId: string) => {
    return !!getBiometricByVisitorId(pdlId);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'detained':
        return <Badge className="status-detained">DETAINED</Badge>;
      case 'released':
        return <Badge className="status-released">RELEASED</Badge>;
      case 'transferred':
        return <Badge className="status-pending">TRANSFERRED</Badge>;
      case 'deceased':
        return <Badge className="status-blacklisted">DECEASED</Badge>;
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
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
            PDL MASTERLIST
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage Person Deprived of Liberty records
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="btn-scanner">
          <Plus className="w-5 h-5 mr-2" />
          ADD NEW PDL
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
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                className="pl-10 input-field uppercase"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] input-field">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ALL STATUS</SelectItem>
                <SelectItem value="detained">DETAINED</SelectItem>
                <SelectItem value="released">RELEASED</SelectItem>
                <SelectItem value="transferred">TRANSFERRED</SelectItem>
                <SelectItem value="deceased">DECEASED</SelectItem>
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
                  <th>PDL CODE</th>
                  <th>NAME</th>
                  <th>GENDER</th>
                  <th>AGE</th>
                  <th>DATE OF COMMIT</th>
                  <th>STATUS</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPDLs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">NO PDL RECORDS FOUND</p>
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
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden relative">
                            {pdl.photo_url ? (
                              <img src={pdl.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-semibold text-muted-foreground">
                                {pdl.first_name.charAt(0)}{pdl.last_name.charAt(0)}
                              </span>
                            )}
                            {hasBiometrics(pdl.id) && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                                <Scan className="w-2.5 h-2.5 text-success-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground uppercase">
                              {pdl.last_name}, {pdl.first_name} {pdl.middle_name} {pdl.suffix}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              DOB: {new Date(pdl.date_of_birth).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="uppercase">{pdl.gender}</td>
                      <td>
                        <span className="text-sm">{calculateAge(pdl.date_of_birth)} YRS</span>
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
                              EDIT
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setViewingPDL(pdl)}>
                              <Eye className="w-4 h-4 mr-2" />
                              VIEW DETAILS
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowIDCard(pdl)}>
                              <CreditCard className="w-4 h-4 mr-2" />
                              GENERATE ID
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
              {editingPDL ? 'EDIT PDL RECORD' : 'ADD NEW PDL'}
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
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : capturedPhoto ? (
                  <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                )}
                
                {enrollingBiometrics && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
              
              {enrollingBiometrics && (
                <div className="w-48 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CAPTURING...</span>
                    <span className="text-primary font-mono">{Math.round(biometricProgress)}%</span>
                  </div>
                  <Progress value={biometricProgress} className="h-1.5" />
                </div>
              )}
              
              <div className="flex gap-2">
                {showCamera ? (
                  <>
                    <Button type="button" onClick={capturePhoto} className="btn-scanner" size="sm">
                      <Check className="w-4 h-4 mr-1" />
                      CAPTURE
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                      CANCEL
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={() => startCamera()}>
                      <Camera className="w-4 h-4 mr-1" />
                      {capturedPhoto ? 'RETAKE' : 'TAKE PHOTO'}
                    </Button>
                    {capturedPhoto && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setCapturedPhoto(null)}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        REMOVE
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>FIRST NAME *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value.toUpperCase() }))}
                  className="input-field uppercase"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>MIDDLE NAME</Label>
                <Input
                  value={formData.middle_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, middle_name: e.target.value.toUpperCase() }))}
                  className="input-field uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>LAST NAME *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value.toUpperCase() }))}
                  className="input-field uppercase"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>SUFFIX</Label>
                <Input
                  value={formData.suffix}
                  onChange={(e) => setFormData(prev => ({ ...prev, suffix: e.target.value.toUpperCase() }))}
                  className="input-field uppercase"
                  placeholder="JR., SR., III, ETC."
                />
              </div>
              <div className="space-y-2">
                <Label>DATE OF BIRTH *</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>GENDER *</Label>
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
                <Label>AGE (AUTO-CALCULATED)</Label>
                <Input
                  value={formData.date_of_birth ? `${calculateAge(formData.date_of_birth)} YEARS OLD` : ''}
                  className="input-field"
                  disabled
                  placeholder="ENTER DOB FIRST"
                />
              </div>
              <div className="space-y-2">
                <Label>STATUS *</Label>
                <Select value={formData.status} onValueChange={(val: 'detained' | 'released' | 'transferred' | 'deceased') => setFormData(prev => ({ ...prev, status: val }))}>
                  <SelectTrigger className="input-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detained">DETAINED</SelectItem>
                    <SelectItem value="released">RELEASED</SelectItem>
                    <SelectItem value="transferred">TRANSFERRED</SelectItem>
                    <SelectItem value="deceased">DECEASED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DATE OF COMMITMENT *</Label>
                <Input
                  type="date"
                  value={formData.date_of_commit}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_commit: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>CASE NUMBER</Label>
                <Input
                  value={formData.case_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, case_number: e.target.value.toUpperCase() }))}
                  className="input-field uppercase"
                  placeholder="E.G., CR-2024-001"
                />
              </div>
            </div>
            
            {/* Crimes/Offenses Section */}
            <div className="space-y-3">
              <Label>CRIMES/OFFENSES COMMITTED</Label>
              <div className="flex gap-2">
                <Input
                  value={newCrime}
                  onChange={(e) => setNewCrime(e.target.value.toUpperCase())}
                  className="input-field uppercase flex-1"
                  placeholder="ENTER CRIME/OFFENSE"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCrime())}
                />
                <Button type="button" onClick={addCrime} variant="secondary" size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.crimes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.crimes.map((crime, index) => (
                    <Badge key={index} variant="secondary" className="px-2 py-1 text-xs gap-1">
                      {crime}
                      <button type="button" onClick={() => removeCrime(index)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                CANCEL
              </Button>
              <Button type="submit" className="btn-scanner">
                {editingPDL ? 'UPDATE PDL' : 'ADD PDL'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewingPDL} onOpenChange={() => setViewingPDL(null)}>
        <DialogContent className="sm:max-w-lg glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl">PDL DETAILS</DialogTitle>
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
                  <h3 className="text-xl font-bold text-foreground uppercase">
                    {viewingPDL.last_name}, {viewingPDL.first_name}
                  </h3>
                  <p className="font-mono text-primary">{viewingPDL.pdl_code}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {statusBadge(viewingPDL.status)}
                    {hasBiometrics(viewingPDL.id) && (
                      <Badge className="bg-success/20 text-success border-success/30">
                        <Scan className="w-3 h-3 mr-1" />
                        BIOMETRICS
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">DATE OF BIRTH</p>
                  <p className="text-foreground">{new Date(viewingPDL.date_of_birth).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GENDER</p>
                  <p className="text-foreground uppercase">{viewingPDL.gender}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">AGE</p>
                  <p className="text-foreground">{calculateAge(viewingPDL.date_of_birth)} YEARS OLD</p>
                </div>
                <div>
                  <p className="text-muted-foreground">COMMITMENT DATE</p>
                  <p className="text-foreground">{new Date(viewingPDL.date_of_commit).toLocaleDateString()}</p>
                </div>
                {viewingPDL.case_number && (
                  <div>
                    <p className="text-muted-foreground">CASE NUMBER</p>
                    <p className="text-foreground uppercase">{viewingPDL.case_number}</p>
                  </div>
                )}
                {viewingPDL.crimes && viewingPDL.crimes.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">CRIMES/OFFENSES</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {viewingPDL.crimes.map((crime, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{crime}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={() => { setViewingPDL(null); setShowIDCard(viewingPDL); }} className="w-full">
                <CreditCard className="w-4 h-4 mr-2" />
                GENERATE ID CARD
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ID Card Dialog */}
      <Dialog open={!!showIDCard} onOpenChange={() => setShowIDCard(null)}>
        <DialogContent className="sm:max-w-md glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl">PDL ID CARD</DialogTitle>
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
                PRINT ID CARD
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
