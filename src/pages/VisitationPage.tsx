import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Camera, QrCode, Search, LogIn, LogOut,
  User, AlertCircle, Check, X, Scan, Loader2
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  getVisitorByCode, getVisitors, getPDLs, getPDLVisitorLinks,
  getOpenSession, createVisitSession, updateVisitSession,
  getActiveSessions, getCompletedTodaySessions, createAuditLog,
  getSettings, getBiometrics, getVisitorById
} from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { RELATIONSHIP_LABELS } from '@/types';
import { useCameraDevices } from '@/components/CameraSelector';
import { useCameraContext } from '@/hooks/useCameraContext';
import type { Visitor, PDLVisitorLink, VisitType, TimeMethod } from '@/types';
import { Html5Qrcode } from 'html5-qrcode';
import { useFaceDetection, arrayToDescriptor } from '@/hooks/useFaceDetection';

export default function VisitationPage() {
  const [activeTab, setActiveTab] = useState('time-in');
  const [idMethod, setIdMethod] = useState<'manual' | 'qr' | 'face'>('manual');
  const [scannerActive, setScannerActive] = useState(false);
  const [faceScanning, setFaceScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [foundVisitor, setFoundVisitor] = useState<Visitor | null>(null);
  const [selectedLink, setSelectedLink] = useState<PDLVisitorLink | null>(null);
  const [visitType, setVisitType] = useState<VisitType>('regular');
  const [activeSessions, setActiveSessions] = useState(getActiveSessions());
  const [completedSessions, setCompletedSessions] = useState(getCompletedTodaySessions());
  const [faceMessage, setFaceMessage] = useState('Position face in frame');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const pdls = getPDLs();
  const visitors = getVisitors();
  const links = getPDLVisitorLinks();
  const settings = getSettings();

  const { isLoaded, isLoading: faceLoading, loadModels, detectFace, getMatchScore } = useFaceDetection();
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();
  const { setActive: setCameraActive } = useCameraContext();

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSessions(getActiveSessions());
      setCompletedSessions(getCompletedTodaySessions());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const startQRScanner = async () => {
    try {
      // Stop any existing scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }

      // Request camera permission (then immediately release it)
      const permStream = await navigator.mediaDevices.getUserMedia({ video: true });
      permStream.getTracks().forEach((t) => t.stop());

      // Render the target element before initializing Html5Qrcode
      setScannerActive(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      // html5-qrcode expects a deviceId string OR { facingMode }
      const cameraIdOrConfig = selectedDeviceId || { facingMode: 'environment' as const };

      await scanner.start(
        cameraIdOrConfig,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleCodeScanned(decodedText, 'qr_scan');
          stopQRScanner();
        },
        () => {}
      );
      
      // Camera is now active - update favicon indicator
      setCameraActive(true);
    } catch (error: any) {
      console.error('QR Scanner error:', error);
      setScannerActive(false);

      let message = 'Unable to start QR scanner.';
      if (error?.name === 'NotAllowedError') {
        message = 'Camera permission denied. Please allow camera access.';
      } else if (error?.name === 'NotFoundError') {
        message = 'No camera found on this device.';
      } else if (error?.name === 'NotReadableError') {
        message = 'Camera is in use by another application.';
      } else if (typeof error?.message === 'string' && error.message.trim()) {
        message = `Unable to start QR scanner: ${error.message}`;
      }

      toast({
        title: 'Scanner Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const stopQRScanner = useCallback(() => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (scanner) {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
      
      // Camera is no longer active
      setCameraActive(false);
    }

    setScannerActive(false);
  }, [setCameraActive]);

  const startFaceScanner = useCallback(async () => {
    if (!isLoaded) {
      toast({
        title: 'Loading',
        description: 'Face detection models are still loading...',
      });
      return;
    }

    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraActive(false);
      }

      // Mount the <video> element first, then attach the stream
      setFaceMessage('Starting camera...');
      setFaceScanning(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error('Video element not ready');

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;

      await video.play();
      
      // Camera is now active - update favicon indicator
      setCameraActive(true);

      setFaceMessage('Scanning face...');
    } catch (err: any) {
      console.error('Face scanner error:', err);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setFaceScanning(false);
      setFaceMessage('Position face in frame');

      let message = 'Unable to access camera for face scanning.';
      if (err?.name === 'NotAllowedError') {
        message = 'Camera permission denied. Please allow camera access.';
      } else if (err?.name === 'NotFoundError') {
        message = 'No camera found on this device.';
      } else if (err?.name === 'NotReadableError') {
        message = 'Camera is in use by another application.';
      } else if (typeof err?.message === 'string' && err.message.trim()) {
        message = `Unable to start face scan: ${err.message}`;
      }

      toast({
        title: 'Camera Error',
        description: message,
        variant: 'destructive',
      });
    }
  }, [isLoaded, selectedDeviceId, toast, setCameraActive]);

  const stopFaceScanner = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
    setFaceScanning(false);
  }, [setCameraActive]);

  const runFaceDetection = useCallback(async () => {
    if (!videoRef.current || !isLoaded || !faceScanning) return;

    const detection = await detectFace(videoRef.current);
    
    if (detection) {
      const biometrics = getBiometrics();
      let bestMatch: { visitorId: string; score: number } | null = null;
      let secondBest = 0;
      
      for (const bio of biometrics) {
        for (const storedEmb of bio.embeddings) {
          const storedDescriptor = arrayToDescriptor(storedEmb);
          const distance = Math.sqrt(
            detection.descriptor.reduce((sum, val, i) => 
              sum + Math.pow(val - storedDescriptor[i], 2), 0
            )
          );
          const score = getMatchScore(distance);
          
          if (!bestMatch || score > bestMatch.score) {
            secondBest = bestMatch?.score || 0;
            bestMatch = { visitorId: bio.visitor_id, score };
          } else if (score > secondBest) {
            secondBest = score;
          }
        }
      }
      
      if (bestMatch && 
          bestMatch.score >= settings.face_recognition_threshold &&
          (bestMatch.score - secondBest) >= settings.face_recognition_margin) {
        const visitor = getVisitorById(bestMatch.visitorId);
        if (visitor && visitor.status === 'active') {
          stopFaceScanner();
          setFoundVisitor(visitor);
          
          const openSession = getOpenSession(visitor.id);
          if (openSession) {
            setActiveTab('time-out');
            setSelectedLink(links.find(l => l.id === openSession.pdl_visitor_link_id) || null);
          } else {
            const approvedLinks = links.filter(l => 
              l.visitor_id === visitor.id && l.approval_status === 'approved'
            );
            if (approvedLinks.length === 1) {
              setSelectedLink(approvedLinks[0]);
            }
          }
          
          toast({
            title: 'Face Matched!',
            description: `${visitor.first_name} ${visitor.last_name} (${Math.round(bestMatch.score * 100)}% confidence)`,
          });
          return;
        }
      }
      
      setFaceMessage('Face detected, searching...');
    } else {
      setFaceMessage('Position face in frame');
    }

    if (faceScanning) {
      setTimeout(runFaceDetection, 200);
    }
  }, [isLoaded, faceScanning, detectFace, getMatchScore, settings, stopFaceScanner, links, toast]);

  useEffect(() => {
    if (faceScanning && isLoaded) {
      runFaceDetection();
    }
  }, [faceScanning, isLoaded, runFaceDetection]);

  useEffect(() => {
    return () => {
      stopFaceScanner();
      stopQRScanner();
    };
  }, [stopFaceScanner]);

  const handleCodeScanned = (code: string, method: TimeMethod) => {
    const visitor = getVisitorByCode(code);
    if (!visitor) {
      toast({
        title: 'Visitor Not Found',
        description: `No visitor found with code: ${code}`,
        variant: 'destructive',
      });
      return;
    }

    if (visitor.status !== 'active') {
      toast({
        title: 'Visitor Inactive',
        description: 'This visitor is not active and cannot visit.',
        variant: 'destructive',
      });
      return;
    }

    setFoundVisitor(visitor);
    
    const openSession = getOpenSession(visitor.id);
    if (openSession) {
      setActiveTab('time-out');
      setSelectedLink(links.find(l => l.id === openSession.pdl_visitor_link_id) || null);
    } else {
      setActiveTab('time-in');
      const approvedLinks = links.filter(l => 
        l.visitor_id === visitor.id && l.approval_status === 'approved'
      );
      if (approvedLinks.length === 0) {
        toast({
          title: 'No Approved Links',
          description: 'This visitor has no approved PDL links.',
          variant: 'destructive',
        });
        setFoundVisitor(null);
        return;
      }
      if (approvedLinks.length === 1) {
        setSelectedLink(approvedLinks[0]);
        if (settings.conjugal_relationships.includes(approvedLinks[0].relationship)) {
          setVisitType('regular');
        } else {
          setVisitType('regular');
        }
      }
    }
  };

  const handleManualSearch = () => {
    if (manualCode.length !== 10) {
      toast({
        title: 'Invalid Code',
        description: 'Visitor code must be exactly 10 digits.',
        variant: 'destructive',
      });
      return;
    }
    handleCodeScanned(manualCode, 'manual_id');
    setManualCode('');
  };

  const handleTimeIn = () => {
    if (!foundVisitor || !selectedLink) return;

    if (visitType === 'conjugal' && !settings.conjugal_relationships.includes(selectedLink.relationship)) {
      toast({
        title: 'Conjugal Not Allowed',
        description: 'This relationship type is not eligible for conjugal visits.',
        variant: 'destructive',
      });
      return;
    }

    const session = createVisitSession({
      visitor_id: foundVisitor.id,
      pdl_id: selectedLink.pdl_id,
      pdl_visitor_link_id: selectedLink.id,
      visit_type: visitType,
      time_in: new Date().toISOString(),
      time_in_method: idMethod === 'face' ? 'face_scan' : idMethod === 'qr' ? 'qr_scan' : 'manual_id',
      operator_id: user?.id || '',
    });

    createAuditLog({
      user_id: user?.id || '',
      action: 'visit_time_in',
      target_type: 'visit_session',
      target_id: session.id,
    });

    toast({
      title: 'TIME IN RECORDED',
      description: `${foundVisitor.first_name} ${foundVisitor.last_name} has been timed in.`,
    });

    setActiveSessions(getActiveSessions());
    resetSelection();
  };

  const handleTimeOut = (sessionId?: string) => {
    let targetSession;
    
    if (sessionId) {
      targetSession = activeSessions.find(s => s.id === sessionId);
    } else if (foundVisitor) {
      targetSession = getOpenSession(foundVisitor.id);
    }

    if (!targetSession) {
      toast({
        title: 'No Open Session',
        description: 'No active session found for this visitor.',
        variant: 'destructive',
      });
      return;
    }

    updateVisitSession(targetSession.id, {
      time_out: new Date().toISOString(),
      time_out_method: idMethod === 'face' ? 'face_scan' : idMethod === 'qr' ? 'qr_scan' : 'manual_id',
    });

    createAuditLog({
      user_id: user?.id || '',
      action: 'visit_time_out',
      target_type: 'visit_session',
      target_id: targetSession.id,
    });

    const visitor = visitors.find(v => v.id === targetSession.visitor_id);
    toast({
      title: 'TIME OUT RECORDED',
      description: `${visitor?.first_name} ${visitor?.last_name} has been timed out.`,
    });

    setActiveSessions(getActiveSessions());
    setCompletedSessions(getCompletedTodaySessions());
    resetSelection();
  };

  const resetSelection = () => {
    setFoundVisitor(null);
    setSelectedLink(null);
    setVisitType('regular');
  };

  const getVisitorLinks = (visitorId: string) => {
    return links.filter(l => l.visitor_id === visitorId && l.approval_status === 'approved');
  };

  const isConjugalEligible = (relationship: string) => {
    return settings.conjugal_relationships.includes(relationship as any);
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
            <Clock className="w-8 h-8 text-primary" />
            Visitation Operations
          </h1>
          <p className="text-muted-foreground mt-1">
            Process visitor time-in and time-out
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="status-active text-sm px-4 py-2 uppercase">
            <Clock className="w-4 h-4 mr-2" />
            {activeSessions.length} ACTIVE SESSION{activeSessions.length !== 1 ? 'S' : ''}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">VISITOR IDENTIFICATION</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Identification Methods */}
              <Tabs value={idMethod} onValueChange={(v) => setIdMethod(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    MANUAL ID
                  </TabsTrigger>
                  <TabsTrigger value="qr" className="flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    QR SCAN
                  </TabsTrigger>
                  <TabsTrigger value="face" className="flex items-center gap-2">
                    <Scan className="w-4 h-4" />
                    FACE SCAN
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="manual" className="mt-4">
                  <div className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit visitor code"
                      className="input-field font-mono text-lg"
                      maxLength={10}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                    />
                    <Button 
                      onClick={handleManualSearch}
                      className="btn-scanner"
                      disabled={manualCode.length !== 10}
                    >
                      <Search className="w-5 h-5" />
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="qr" className="mt-4">
                  <div className="space-y-4">
                    {/* Camera Selector for QR */}
                    {devices.length > 1 && !scannerActive && (
                      <div className="flex justify-center">
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
                      </div>
                    )}
                    
                    {scannerActive ? (
                      <div className="space-y-4">
                        <div id="qr-reader" className="scanner-frame mx-auto max-w-sm rounded-xl overflow-hidden" />
                        <Button 
                          variant="outline" 
                          onClick={stopQRScanner}
                          className="w-full"
                        >
                          STOP SCANNER
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={startQRScanner}
                        className="w-full btn-scanner h-24 text-lg"
                      >
                        <QrCode className="w-8 h-8 mr-3" />
                        START QR SCANNER
                      </Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="face" className="mt-4">
                  <div className="space-y-4">
                    {faceLoading && (
                      <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">Loading face detection...</p>
                      </div>
                    )}
                    
                    {/* Camera Selector for Face */}
                    {devices.length > 1 && !faceScanning && !faceLoading && (
                      <div className="flex justify-center">
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
                      </div>
                    )}
                    
                    {!faceLoading && faceScanning ? (
                      <div className="space-y-4">
                        <div className="relative w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden bg-muted border-2 border-primary/50">
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
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                          </div>
                          <div className="absolute bottom-4 left-0 right-0 text-center">
                            <span className="bg-background/80 text-foreground text-sm px-3 py-1 rounded-full">
                              {faceMessage}
                            </span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={stopFaceScanner}
                          className="w-full"
                        >
                          STOP SCANNER
                        </Button>
                      </div>
                    ) : !faceLoading && (
                      <Button 
                        onClick={startFaceScanner}
                        className="w-full btn-scanner h-24 text-lg"
                        disabled={!isLoaded}
                      >
                        <Scan className="w-8 h-8 mr-3" />
                        START FACE SCANNER
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Found Visitor Info */}
              <AnimatePresence>
                {foundVisitor && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 rounded-xl bg-success/10 border border-success/30"
                  >
                    <div className="flex items-center gap-4">
                      {foundVisitor.photo_url ? (
                        <img 
                          src={foundVisitor.photo_url} 
                          alt={foundVisitor.first_name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-success"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                          <User className="w-8 h-8 text-success" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-lg text-foreground uppercase">
                          {foundVisitor.last_name}, {foundVisitor.first_name}
                        </p>
                        <p className="text-sm font-mono text-success">
                          ID: {foundVisitor.visitor_code}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={resetSelection}>
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    {/* PDL Selection */}
                    {activeTab === 'time-in' && (
                      <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                          <Label>SELECT PDL TO VISIT</Label>
                          <Select 
                            value={selectedLink?.id || ''} 
                            onValueChange={(v) => setSelectedLink(links.find(l => l.id === v) || null)}
                          >
                            <SelectTrigger className="input-field">
                              <SelectValue placeholder="Select PDL" />
                            </SelectTrigger>
                            <SelectContent>
                              {getVisitorLinks(foundVisitor.id).map(link => {
                                const pdl = pdls.find(p => p.id === link.pdl_id);
                                return (
                                  <SelectItem key={link.id} value={link.id}>
                                    {pdl?.last_name}, {pdl?.first_name} ({RELATIONSHIP_LABELS[link.relationship]})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {selectedLink && (
                          <div className="space-y-2">
                            <Label>VISIT TYPE</Label>
                            <Select value={visitType} onValueChange={(v) => setVisitType(v as VisitType)}>
                              <SelectTrigger className="input-field">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="regular">REGULAR VISIT</SelectItem>
                                {isConjugalEligible(selectedLink.relationship) && (
                                  <SelectItem value="conjugal">CONJUGAL VISIT</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <Button 
                          onClick={handleTimeIn}
                          className="w-full btn-scanner h-12"
                          disabled={!selectedLink}
                        >
                          <LogIn className="w-5 h-5 mr-2" />
                          RECORD TIME IN
                        </Button>
                      </div>
                    )}
                    
                    {activeTab === 'time-out' && (
                      <div className="mt-4">
                        <Button 
                          onClick={() => handleTimeOut()}
                          className="w-full bg-info hover:bg-info/90 h-12"
                        >
                          <LogOut className="w-5 h-5 mr-2" />
                          RECORD TIME OUT
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions Panel */}
        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                ACTIVE SESSIONS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {activeSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No active sessions
                </p>
              ) : (
                activeSessions.map(session => {
                  const visitor = visitors.find(v => v.id === session.visitor_id);
                  const pdl = pdls.find(p => p.id === session.pdl_id);
                  const duration = Math.round(
                    (Date.now() - new Date(session.time_in).getTime()) / 60000
                  );
                  return (
                    <div 
                      key={session.id} 
                      className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground text-sm uppercase">
                            {visitor?.last_name}, {visitor?.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">
                            → {pdl?.last_name}, {pdl?.first_name}
                          </p>
                        </div>
                        <Badge className={session.visit_type === 'conjugal' ? 'status-approved' : 'status-active'}>
                          {session.visit_type === 'conjugal' ? 'C' : 'R'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.time_in).toLocaleTimeString()} • {duration}m
                        </span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleTimeOut(session.id)}
                          className="h-7 text-xs"
                        >
                          <LogOut className="w-3 h-3 mr-1" />
                          OUT
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Completed Today */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-success" />
                COMPLETED TODAY
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
              {completedSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No completed visits today
                </p>
              ) : (
                completedSessions.slice(0, 10).map(session => {
                  const visitor = visitors.find(v => v.id === session.visitor_id);
                  const duration = session.time_out 
                    ? Math.round((new Date(session.time_out).getTime() - new Date(session.time_in).getTime()) / 60000)
                    : 0;
                  return (
                    <div 
                      key={session.id} 
                      className="p-2 rounded-lg bg-muted/20 flex items-center justify-between"
                    >
                      <span className="text-sm text-foreground truncate uppercase">
                        {visitor?.last_name}, {visitor?.first_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {duration}m
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
