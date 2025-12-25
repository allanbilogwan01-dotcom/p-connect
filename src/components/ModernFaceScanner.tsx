import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, Check, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFaceDetection, arrayToDescriptor } from '@/hooks/useFaceDetection';
import { getBiometrics, getVisitorById, getSettings } from '@/lib/localStorage';
import { useCameraContext } from '@/hooks/useCameraContext';
import { useCameraDevices } from '@/components/CameraSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Visitor } from '@/types';

interface ModernFaceScannerProps {
  onMatch: (visitor: Visitor, confidence: number) => void;
  onCancel: () => void;
}

type LivenessState = 'idle' | 'look_center' | 'blink' | 'verifying' | 'success' | 'failed';

const LIVENESS_INSTRUCTIONS: Record<LivenessState, string> = {
  idle: 'STARTING CAMERA...',
  look_center: 'LOOK DIRECTLY AT THE CAMERA',
  blink: 'BLINK YOUR EYES',
  verifying: 'VERIFYING IDENTITY...',
  success: 'IDENTITY VERIFIED',
  failed: 'VERIFICATION FAILED',
};

export function ModernFaceScanner({ onMatch, onCancel }: ModernFaceScannerProps) {
  const [livenessState, setLivenessState] = useState<LivenessState>('idle');
  const [isScanning, setIsScanning] = useState(false);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [faceDetectedCount, setFaceDetectedCount] = useState(0);
  const [matchedVisitor, setMatchedVisitor] = useState<Visitor | null>(null);
  const [matchConfidence, setMatchConfidence] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blinkCheckRef = useRef<{ lastEAR: number; blinkCount: number }>({ lastEAR: 0, blinkCount: 0 });
  
  const { isLoaded, isLoading, loadModels, detectFace, getMatchScore } = useFaceDetection();
  const { setActive, selectedDeviceId, setSelectedDeviceId } = useCameraContext();
  const { devices } = useCameraDevices();
  const settings = getSettings();

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setIsScanning(true);
      setLivenessState('look_center');
    } catch (err) {
      console.error('Camera error:', err);
      setLivenessState('failed');
    }
  }, [selectedDeviceId, setActive]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setActive(false);
    setIsScanning(false);
  }, [setActive]);

  // Calculate Eye Aspect Ratio for blink detection
  const calculateEAR = (landmarks: { x: number; y: number }[]): number => {
    // Simplified EAR calculation using face landmarks
    // Left eye: points 36-41, Right eye: points 42-47
    const leftEye = landmarks.slice(36, 42);
    const rightEye = landmarks.slice(42, 48);
    
    if (leftEye.length < 6 || rightEye.length < 6) return 0.3;
    
    const eyeAspectRatio = (eye: { x: number; y: number }[]) => {
      const vertical1 = Math.sqrt(Math.pow(eye[1].y - eye[5].y, 2) + Math.pow(eye[1].x - eye[5].x, 2));
      const vertical2 = Math.sqrt(Math.pow(eye[2].y - eye[4].y, 2) + Math.pow(eye[2].x - eye[4].x, 2));
      const horizontal = Math.sqrt(Math.pow(eye[0].y - eye[3].y, 2) + Math.pow(eye[0].x - eye[3].x, 2));
      return (vertical1 + vertical2) / (2.0 * horizontal);
    };
    
    return (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
  };

  const runLivenessCheck = useCallback(async () => {
    if (!videoRef.current || !isLoaded || !isScanning) return;

    const detection = await detectFace(videoRef.current);
    
    if (detection) {
      setFaceDetectedCount(prev => prev + 1);
      
      // Get landmarks for blink detection
      const landmarks = detection.landmarks.positions.map(p => ({ x: p.x, y: p.y }));
      const ear = calculateEAR(landmarks);
      
      // Check for blink (EAR drops significantly)
      if (livenessState === 'blink') {
        if (blinkCheckRef.current.lastEAR > 0.2 && ear < 0.18) {
          blinkCheckRef.current.blinkCount++;
          if (blinkCheckRef.current.blinkCount >= 1) {
            setBlinkDetected(true);
            setLivenessState('verifying');
          }
        }
        blinkCheckRef.current.lastEAR = ear;
      }
      
      // After 3 face detections, move to blink check
      if (livenessState === 'look_center' && faceDetectedCount >= 3) {
        setLivenessState('blink');
      }
      
      // During verification, perform face matching
      if (livenessState === 'verifying') {
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
        
        const threshold = settings.face_recognition_threshold || 0.7;
        const margin = settings.face_recognition_margin || 0.15;
        
        if (bestMatch && 
            bestMatch.score >= threshold &&
            (bestMatch.score - secondBest) >= margin) {
          const visitor = getVisitorById(bestMatch.visitorId);
          if (visitor && visitor.status === 'active') {
            setMatchedVisitor(visitor);
            setMatchConfidence(bestMatch.score);
            setLivenessState('success');
            stopCamera();
            setTimeout(() => {
              onMatch(visitor, bestMatch.score);
            }, 1500);
            return;
          }
        }
        
        // Continue searching for a few more tries
        if (faceDetectedCount < 20) {
          setTimeout(runLivenessCheck, 200);
          return;
        }
        
        setLivenessState('failed');
        return;
      }
    }
    
    if (isScanning && livenessState !== 'success' && livenessState !== 'failed') {
      setTimeout(runLivenessCheck, 150);
    }
  }, [isLoaded, isScanning, livenessState, faceDetectedCount, detectFace, getMatchScore, settings, stopCamera, onMatch]);

  useEffect(() => {
    if (isScanning && isLoaded && livenessState !== 'idle' && livenessState !== 'success' && livenessState !== 'failed') {
      runLivenessCheck();
    }
  }, [isScanning, isLoaded, livenessState, runLivenessCheck]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const retryLiveness = () => {
    setLivenessState('look_center');
    setBlinkDetected(false);
    setFaceDetectedCount(0);
    blinkCheckRef.current = { lastEAR: 0, blinkCount: 0 };
    startCamera();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center gap-4"
    >
      {/* Camera Selector */}
      {devices.length > 1 && !isScanning && (
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
      
      {/* Video Container with Modern Design */}
      <div className="relative w-80 h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-primary/30 shadow-2xl">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">LOADING FACE DETECTION...</p>
          </div>
        )}
        
        {!isScanning && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Camera className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">CAMERA NOT STARTED</p>
          </div>
        )}
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        
        {/* Animated Scanner Overlay */}
        {isScanning && (
          <>
            {/* Circular face guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div 
                className="w-48 h-56 rounded-[50%] border-2 border-primary/60"
                animate={{ 
                  borderColor: livenessState === 'success' 
                    ? 'hsl(var(--success))' 
                    : livenessState === 'failed' 
                      ? 'hsl(var(--destructive))' 
                      : 'hsl(var(--primary) / 0.6)'
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            {/* Scanning Line Animation */}
            {(livenessState === 'look_center' || livenessState === 'blink' || livenessState === 'verifying') && (
              <motion.div
                className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                initial={{ top: '20%' }}
                animate={{ top: ['20%', '80%', '20%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            )}
            
            {/* Corner Brackets */}
            <div className="absolute inset-12 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>
            
            {/* Blinking Indicator Light */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <motion.div
                className="w-3 h-3 rounded-full"
                animate={{
                  backgroundColor: livenessState === 'success' 
                    ? 'hsl(var(--success))' 
                    : livenessState === 'failed' 
                      ? 'hsl(var(--destructive))' 
                      : 'hsl(var(--primary))',
                  scale: [1, 1.2, 1],
                }}
                transition={{ 
                  scale: { duration: 0.5, repeat: Infinity },
                  backgroundColor: { duration: 0.3 }
                }}
              />
              <span className="text-xs text-white/70 font-mono">
                {livenessState === 'verifying' ? 'SCANNING' : livenessState === 'success' ? 'MATCHED' : 'LIVE'}
              </span>
            </div>
            
            {/* Blink indicator */}
            {livenessState === 'blink' && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  {blinkDetected ? <Eye className="w-5 h-5 text-success" /> : <EyeOff className="w-5 h-5 text-primary" />}
                </motion.div>
              </div>
            )}
          </>
        )}
        
        {/* Status Overlay */}
        <AnimatePresence>
          {livenessState === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-success/20 flex flex-col items-center justify-center"
            >
              <motion.div 
                className="w-20 h-20 rounded-full bg-success flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <Check className="w-10 h-10 text-success-foreground" />
              </motion.div>
              {matchedVisitor && (
                <motion.p 
                  className="mt-4 text-white font-bold text-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {matchedVisitor.first_name} {matchedVisitor.last_name}
                </motion.p>
              )}
            </motion.div>
          )}
          {livenessState === 'failed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-destructive/20 flex items-center justify-center"
            >
              <div className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center">
                <X className="w-10 h-10 text-destructive-foreground" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instruction Display */}
      <motion.div 
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50"
        animate={{ 
          backgroundColor: livenessState === 'success' 
            ? 'hsl(var(--success) / 0.2)' 
            : livenessState === 'failed' 
              ? 'hsl(var(--destructive) / 0.2)' 
              : 'hsl(var(--muted) / 0.5)'
        }}
      >
        {livenessState === 'verifying' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        {livenessState === 'success' && <Check className="w-4 h-4 text-success" />}
        {livenessState === 'failed' && <AlertCircle className="w-4 h-4 text-destructive" />}
        {(livenessState === 'look_center' || livenessState === 'blink') && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Camera className="w-4 h-4 text-primary" />
          </motion.div>
        )}
        <span className={`text-sm font-medium ${
          livenessState === 'success' ? 'text-success' :
          livenessState === 'failed' ? 'text-destructive' :
          'text-muted-foreground'
        }`}>
          {LIVENESS_INSTRUCTIONS[livenessState]}
        </span>
      </motion.div>

      {/* Match Confidence */}
      {livenessState === 'success' && matchConfidence > 0 && (
        <motion.div 
          className="text-sm text-success"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Confidence: {Math.round(matchConfidence * 100)}%
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!isScanning && livenessState !== 'success' && (
          <Button onClick={startCamera} className="btn-scanner" disabled={isLoading}>
            <Camera className="w-4 h-4 mr-2" />
            START SCAN
          </Button>
        )}
        
        {livenessState === 'failed' && (
          <Button onClick={retryLiveness} className="btn-scanner">
            <Camera className="w-4 h-4 mr-2" />
            RETRY
          </Button>
        )}
        
        <Button variant="outline" onClick={handleCancel}>
          CANCEL
        </Button>
      </div>
    </motion.div>
  );
}
