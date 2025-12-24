import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UserPlus, Search, Camera, QrCode, Check, 
  MoreHorizontal, Edit, Eye, RefreshCw, CreditCard,
  Download, Scan, Loader2, Plus
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
import { getVisitors, createVisitor, updateVisitor, createAuditLog, saveBiometric, getBiometricByVisitorId } from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { VisitorIDCard } from '@/components/IDCard';
import { useFaceDetection, descriptorToArray } from '@/hooks/useFaceDetection';
import type { Visitor } from '@/types';

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
  const [enrollingBiometrics, setEnrollingBiometrics] = useState(false);
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const idCardRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const { isLoaded, isLoading: faceLoading, loadModels, detectFace } = useFaceDetection();

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
    setEnrollingBiometrics(false);
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

  const startBiometricEnrollment = async (visitorId: string) => {
    if (!isLoaded) {
      toast({ title: 'Loading', description: 'Face detection is loading...' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEnrollingBiometrics(true);
      setCapturedEmbeddings([]);
      setBiometricProgress(0);
      
      // Run enrollment loop
      runEnrollmentCapture(visitorId);
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera for biometric enrollment.',
        variant: 'destructive',
      });
    }
  };

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
          // Save biometrics
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
          
          return newEmbeddings;
        }
        
        // Continue capturing
        setTimeout(() => runEnrollmentCapture(visitorId), 500);
        return newEmbeddings;
      });
    } else {
      // No face detected, retry
      if (enrollingBiometrics) {
        setTimeout(() => runEnrollmentCapture(visitorId), 200);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingVisitor) {
      const updated = updateVisitor(editingVisitor.id, {
        ...formData,
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
    } else {
      const newVisitor = createVisitor({ 
        ...formData, 
        status: 'active',
        photo_url: capturedPhoto || undefined,
      });
      setVisitors(getVisitors());
      createAuditLog({
        user_id: user?.id || '',
        action: 'visitor_created',
        target_type: 'visitor',
        target_id: newVisitor.id,
      });
      toast({ 
        title: 'Visitor Enrolled', 
        description: `${newVisitor.first_name} ${newVisitor.last_name} registered with ID: ${newVisitor.visitor_code}` 
      });
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
      contact_number: '',
      address: '',
      valid_id_type: '',
      valid_id_number: '',
    });
    setEditingVisitor(null);
    setCapturedPhoto(null);
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
        return <Badge className="status-active">Active</Badge>;
      case 'blacklisted':
        return <Badge className="status-rejected">Blacklisted</Badge>;
      case 'inactive':
        return <Badge className="status-detained">Inactive</Badge>;
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
            <UserPlus className="w-8 h-8 text-primary" />
            Visitor Enrollment
          </h1>
          <p className="text-muted-foreground mt-1">
            Register and manage visitor records with biometric enrollment
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="btn-scanner">
          <Plus className="w-5 h-5 mr-2" />
          Enroll Visitor
        </Button>
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
                        Enrolled
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
                      {!hasBiometrics(visitor.id) && (
                        <Button 
                          size="sm" 
                          className="bg-primary/80"
                          onClick={() => startBiometricEnrollment(visitor.id)}
                          disabled={faceLoading}
                        >
                          <Scan className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-foreground truncate">
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

      {/* Enrollment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-3xl glass-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-primary" />
              {editingVisitor ? 'Edit Visitor' : 'Enroll New Visitor'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Capture */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-48 h-48 rounded-2xl overflow-hidden bg-muted border-2 border-dashed border-border relative">
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
                    <Camera className="w-12 h-12 text-muted-foreground/50" />
                  </div>
                )}
              </div>
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
                    <Button type="button" variant="secondary" onClick={startCamera}>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, valid_id_type: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., Driver's License"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="input-field"
                  placeholder="Complete address"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Valid ID Number</Label>
                <Input
                  value={formData.valid_id_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, valid_id_number: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" className="btn-scanner">
                {editingVisitor ? 'Update Visitor' : 'Enroll Visitor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
        <DialogContent className="sm:max-w-sm glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">Visitor QR Code</DialogTitle>
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
                <p className="font-semibold text-foreground">
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
            <DialogTitle className="text-xl">Visitor ID Card</DialogTitle>
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
                    onClick={() => { setShowIDCard(null); startBiometricEnrollment(showIDCard.id); }}
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

      {/* Biometric Enrollment Modal */}
      <Dialog open={enrollingBiometrics} onOpenChange={() => stopCamera()}>
        <DialogContent className="sm:max-w-md glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Scan className="w-6 h-6 text-primary" />
              Biometric Enrollment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-muted">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Scan overlay */}
              <div className="absolute inset-8 border-2 border-primary/50 rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-xl" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Capturing face data...</span>
                <span className="text-primary font-mono">{Math.round(biometricProgress)}%</span>
              </div>
              <Progress value={biometricProgress} className="h-2" />
            </div>
            
            <p className="text-center text-sm text-muted-foreground">
              Keep your face centered in the frame. Moving slightly helps capture better data.
            </p>
            
            <Button variant="outline" onClick={stopCamera} className="w-full">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
