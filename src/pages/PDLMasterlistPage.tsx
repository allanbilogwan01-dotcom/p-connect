import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Plus, Search, Filter, MoreHorizontal, 
  Edit, Eye, Camera, Download, CreditCard, Check, RefreshCw, Scan, Loader2, X, Upload, FileSpreadsheet
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
import { exportPDLsToExcel, parsePDLsFromExcel, downloadPDLTemplate, calculateAge } from '@/lib/excelUtils';
import type { PDL, CrimeEntry } from '@/types';

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
  const [isImporting, setIsImporting] = useState(false);
  
  // Biometric enrollment states
  const [enrollingBiometrics, setEnrollingBiometrics] = useState(false);
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const idCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    crimes: [] as CrimeEntry[],
    status: 'detained' as 'detained' | 'released' | 'transferred' | 'deceased',
  });
  
  const [newCrime, setNewCrime] = useState({ offense: '', case_number: '' });

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
      status: 'detained',
    });
    setEditingPDL(null);
    setCapturedPhoto(null);
    setCapturedEmbeddings([]);
    setBiometricProgress(0);
    setNewCrime({ offense: '', case_number: '' });
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
      status: pdl.status,
    });
    setCapturedPhoto(pdl.photo_url || null);
    setIsDialogOpen(true);
  };
  
  const addCrime = () => {
    if (newCrime.offense.trim()) {
      setFormData(prev => ({ 
        ...prev, 
        crimes: [...prev.crimes, { 
          offense: newCrime.offense.trim().toUpperCase(),
          case_number: newCrime.case_number.trim().toUpperCase()
        }] 
      }));
      setNewCrime({ offense: '', case_number: '' });
    }
  };
  
  const removeCrime = (index: number) => {
    setFormData(prev => ({ ...prev, crimes: prev.crimes.filter((_, i) => i !== index) }));
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

  const handleExportExcel = () => {
    exportPDLsToExcel(pdls);
    toast({ title: 'EXPORT COMPLETE', description: 'PDL masterlist exported to Excel.' });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const importedPDLs = await parsePDLsFromExcel(file);
      let importedCount = 0;
      
      for (const pdlData of importedPDLs) {
        if (pdlData.first_name && pdlData.last_name && pdlData.date_of_birth) {
          createPDL({
            first_name: pdlData.first_name,
            middle_name: pdlData.middle_name,
            last_name: pdlData.last_name,
            suffix: pdlData.suffix,
            date_of_birth: pdlData.date_of_birth,
            gender: pdlData.gender || 'male',
            date_of_commit: pdlData.date_of_commit || new Date().toISOString().split('T')[0],
            crimes: pdlData.crimes || [],
            status: 'detained',
          });
          importedCount++;
        }
      }
      
      setPDLs(getPDLs());
      toast({ 
        title: 'IMPORT COMPLETE', 
        description: `${importedCount} PDL records imported successfully.` 
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadPDLTemplate} className="gap-2">
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
            ADD NEW PDL
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
                        <Badge variant="outline" className="font-mono">
                          {calculateAge(pdl.date_of_birth)} YRS
                        </Badge>
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
                            <DropdownMenuItem onClick={() => setViewingPDL(pdl)}>
                              <Eye className="w-4 h-4 mr-2" />
                              VIEW DETAILS
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(pdl)}>
                              <Edit className="w-4 h-4 mr-2" />
                              EDIT
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowIDCard(pdl)}>
                              <CreditCard className="w-4 h-4 mr-2" />
                              VIEW ID CARD
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
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsDialogOpen(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {editingPDL ? 'EDIT PDL RECORD' : 'ADD NEW PDL'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Photo Capture */}
              <div className="md:col-span-2">
                <Label>PHOTO</Label>
                <div className="mt-2 flex items-center gap-4">
                  {capturedPhoto ? (
                    <div className="relative">
                      <img src={capturedPhoto} alt="Captured" className="w-32 h-32 rounded-lg object-cover border border-border" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 w-6 h-6"
                        onClick={() => setCapturedPhoto(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : showCamera ? (
                    <div className="space-y-2">
                      {devices.length > 1 && (
                        <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                          <SelectTrigger className="w-48 h-8 text-xs">
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
                      <div className="relative w-48 h-36 rounded-lg overflow-hidden bg-muted">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      </div>
                      {enrollingBiometrics && (
                        <div className="space-y-1">
                          <Progress value={biometricProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground text-center">
                            {Math.round(biometricProgress)}% - Keep looking at camera
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={capturePhoto}>
                          <Camera className="w-4 h-4 mr-1" />
                          CAPTURE
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
                          CANCEL
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => startCamera()}>
                      <Camera className="w-4 h-4 mr-2" />
                      CAPTURE PHOTO
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>FIRST NAME *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value.toUpperCase() })}
                  className="input-field uppercase"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>MIDDLE NAME</Label>
                <Input
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value.toUpperCase() })}
                  className="input-field uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>LAST NAME *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value.toUpperCase() })}
                  className="input-field uppercase"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>SUFFIX</Label>
                <Input
                  value={formData.suffix}
                  onChange={(e) => setFormData({ ...formData, suffix: e.target.value.toUpperCase() })}
                  className="input-field uppercase"
                  placeholder="JR, SR, III, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>DATE OF BIRTH *</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>AGE</Label>
                <div className="h-10 px-3 flex items-center rounded-md border border-border bg-muted/50 font-mono">
                  {formData.date_of_birth ? `${calculateAge(formData.date_of_birth)} YEARS OLD` : '-'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>GENDER *</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v as any })}>
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
                <Label>STATUS *</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
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
                <Label>DATE OF COMMIT *</Label>
                <Input
                  type="date"
                  value={formData.date_of_commit}
                  onChange={(e) => setFormData({ ...formData, date_of_commit: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              
              {/* Crimes Section */}
              <div className="md:col-span-2 space-y-3">
                <Label>CRIMES / OFFENSES COMMITTED</Label>
                <div className="space-y-2">
                  {formData.crimes.map((crime, index) => (
                    <div key={index} className="flex gap-2 items-center p-2 rounded-lg bg-muted/30">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <span className="text-sm truncate">{crime.offense}</span>
                        <span className="text-sm text-muted-foreground truncate">{crime.case_number || 'No case #'}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCrime(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newCrime.offense}
                    onChange={(e) => setNewCrime({ ...newCrime, offense: e.target.value.toUpperCase() })}
                    placeholder="Crime/Offense"
                    className="input-field uppercase flex-1"
                  />
                  <Input
                    value={newCrime.case_number}
                    onChange={(e) => setNewCrime({ ...newCrime, case_number: e.target.value.toUpperCase() })}
                    placeholder="Case Number"
                    className="input-field uppercase flex-1"
                  />
                  <Button type="button" variant="outline" onClick={addCrime} disabled={!newCrime.offense.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                CANCEL
              </Button>
              <Button type="submit" className="btn-scanner">
                <Check className="w-4 h-4 mr-2" />
                {editingPDL ? 'UPDATE PDL' : 'ADD PDL'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingPDL} onOpenChange={() => setViewingPDL(null)}>
        <DialogContent className="max-w-lg glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-primary" />
              PDL DETAILS
            </DialogTitle>
          </DialogHeader>
          
          {viewingPDL && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {viewingPDL.photo_url ? (
                  <img src={viewingPDL.photo_url} alt="" className="w-24 h-24 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold uppercase">
                    {viewingPDL.last_name}, {viewingPDL.first_name} {viewingPDL.middle_name} {viewingPDL.suffix}
                  </h3>
                  <p className="text-primary font-mono">{viewingPDL.pdl_code}</p>
                  {statusBadge(viewingPDL.status)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">DATE OF BIRTH</p>
                  <p className="font-medium">{new Date(viewingPDL.date_of_birth).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">AGE</p>
                  <p className="font-medium">{calculateAge(viewingPDL.date_of_birth)} YEARS OLD</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GENDER</p>
                  <p className="font-medium uppercase">{viewingPDL.gender}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">DATE OF COMMIT</p>
                  <p className="font-medium">{new Date(viewingPDL.date_of_commit).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">CRIMES / CASES</p>
                  <div className="space-y-1 mt-1">
                    {viewingPDL.crimes?.length > 0 ? (
                      viewingPDL.crimes.map((crime, idx) => (
                        <p key={idx} className="font-medium text-sm">
                          {crime.offense} {crime.case_number && `(${crime.case_number})`}
                        </p>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No crimes recorded</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowIDCard(viewingPDL);
                  setViewingPDL(null);
                }}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  VIEW ID CARD
                </Button>
                <Button className="flex-1" onClick={() => {
                  handleEdit(viewingPDL);
                  setViewingPDL(null);
                }}>
                  <Edit className="w-4 h-4 mr-2" />
                  EDIT
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ID Card Dialog */}
      <Dialog open={!!showIDCard} onOpenChange={() => setShowIDCard(null)}>
        <DialogContent className="max-w-md glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              PDL ID CARD
            </DialogTitle>
          </DialogHeader>
          
          {showIDCard && (
            <div className="space-y-4">
              <div ref={idCardRef}>
                <PDLIDCard pdl={showIDCard} />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handlePrintID}>
                  <Download className="w-4 h-4 mr-2" />
                  PRINT
                </Button>
                {!hasBiometrics(showIDCard.id) && (
                  <Button className="flex-1 btn-scanner" onClick={() => {
                    startBiometricEnrollment();
                    setTimeout(() => runEnrollmentCapture(showIDCard.id), 500);
                  }} disabled={faceLoading}>
                    {faceLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scan className="w-4 h-4 mr-2" />}
                    ENROLL BIOMETRICS
                  </Button>
                )}
                {hasBiometrics(showIDCard.id) && (
                  <Button variant="outline" className="flex-1" onClick={() => {
                    startBiometricEnrollment();
                    setTimeout(() => runEnrollmentCapture(showIDCard.id), 500);
                  }} disabled={faceLoading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    RE-ENROLL
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
