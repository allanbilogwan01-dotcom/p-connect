import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, Check, X, AlertCircle, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFaceDetection, descriptorToArray, arrayToDescriptor } from '@/hooks/useFaceDetection';
import { getBiometrics, getVisitorById, getSettings } from '@/lib/localStorage';
import { useCameraContext } from '@/hooks/useCameraContext';
import { CameraSelector } from '@/components/CameraSelector';
import type { Visitor } from '@/types';

interface FaceScannerProps {
  mode: 'enroll' | 'verify';
  onEnrollComplete?: (embeddings: number[][]) => void;
  onVerifyComplete?: (visitor: Visitor | null, confidence: number) => void;
  onCancel: () => void;
}

export default function FaceScanner({ 
  mode, 
  onEnrollComplete, 
  onVerifyComplete, 
  onCancel 
}: FaceScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'detecting' | 'success' | 'failed'>('idle');
  const [message, setMessage] = useState('POSITION YOUR FACE IN THE FRAME');
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const { isLoaded, isLoading, loadModels, detectFace, getMatchScore } = useFaceDetection();
  const { setActive, selectedDeviceId } = useCameraContext();
  const settings = getSettings();

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const startCamera = useCallback(async () => {
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
      setActive(true);
      setIsScanning(true);
      setScanStatus('detecting');
    } catch (err) {
      setMessage('CAMERA ACCESS DENIED. PLEASE ALLOW CAMERA PERMISSIONS.');
      setScanStatus('failed');
    }
  }, [selectedDeviceId, setActive]);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setActive(false);
    setIsScanning(false);
  }, [setActive]);

  const runDetection = useCallback(async () => {
    if (!videoRef.current || !isLoaded || scanStatus !== 'detecting') return;

    const detection = await detectFace(videoRef.current);
    
    if (detection) {
      const embedding = descriptorToArray(detection.descriptor);
      
      if (mode === 'enroll') {
        // Collect multiple embeddings for enrollment
        setCapturedEmbeddings(prev => {
          const newEmbeddings = [...prev, embedding];
          setProgress((newEmbeddings.length / 5) * 100);
          
          if (newEmbeddings.length >= 5) {
            setScanStatus('success');
            setMessage('FACE ENROLLED SUCCESSFULLY!');
            stopCamera();
            setTimeout(() => {
              onEnrollComplete?.(newEmbeddings);
            }, 1000);
            return newEmbeddings;
          }
          
          setMessage(`CAPTURING... ${newEmbeddings.length}/5`);
          return newEmbeddings;
        });
        
        // Wait before next capture
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Verification mode - compare with stored embeddings
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
        
        // Use strict thresholds for high accuracy
        const threshold = settings.face_recognition_threshold || 0.7;
        const margin = settings.face_recognition_margin || 0.15;
        
        if (bestMatch && 
            bestMatch.score >= threshold &&
            (bestMatch.score - secondBest) >= margin) {
          const visitor = getVisitorById(bestMatch.visitorId);
          if (visitor) {
            setScanStatus('success');
            setMessage(`MATCHED: ${visitor.first_name} ${visitor.last_name}`.toUpperCase());
            stopCamera();
            setTimeout(() => {
              onVerifyComplete?.(visitor, bestMatch.score);
            }, 1000);
            return;
          }
        }
        
        setMessage('SCANNING...');
      }
    } else {
      setMessage('POSITION YOUR FACE IN THE FRAME');
    }

    // Continue detection loop
    if (scanStatus === 'detecting') {
      animationRef.current = requestAnimationFrame(() => {
        setTimeout(runDetection, 100);
      });
    }
  }, [isLoaded, mode, scanStatus, detectFace, getMatchScore, settings, stopCamera, onEnrollComplete, onVerifyComplete]);

  useEffect(() => {
    if (isScanning && isLoaded && scanStatus === 'detecting') {
      runDetection();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning, isLoaded, scanStatus, runDetection]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const handleNoMatch = () => {
    stopCamera();
    onVerifyComplete?.(null, 0);
  };

  const handleCameraStream = useCallback((stream: MediaStream) => {
    // Stop current stream if exists
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
    setActive(true);
    setIsScanning(true);
    setScanStatus('detecting');
  }, [setActive]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center gap-4"
    >
      {/* Camera Selector */}
      <CameraSelector 
        onStream={handleCameraStream}
        autoStart={false}
        className="mb-2"
      />
      
      {/* Video Container */}
      <div className="relative w-80 h-80 rounded-2xl overflow-hidden bg-muted border-2 border-primary/30">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
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
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Scan Frame Overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-primary/50 rounded-xl" />
            <div className="absolute inset-8 animate-pulse">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>
          </div>
        )}
        
        {/* Status Overlay */}
        <AnimatePresence>
          {scanStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-success/20 flex items-center justify-center"
            >
              <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center">
                <Check className="w-10 h-10 text-success-foreground" />
              </div>
            </motion.div>
          )}
          {scanStatus === 'failed' && (
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

      {/* Progress Bar (Enrollment) */}
      {mode === 'enroll' && isScanning && (
        <div className="w-80">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-yellow-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Message */}
      <div className="flex items-center gap-2 text-sm">
        {scanStatus === 'detecting' && <Scan className="w-4 h-4 text-primary animate-pulse" />}
        {scanStatus === 'success' && <Check className="w-4 h-4 text-success" />}
        {scanStatus === 'failed' && <AlertCircle className="w-4 h-4 text-destructive" />}
        <span className={
          scanStatus === 'success' ? 'text-success' :
          scanStatus === 'failed' ? 'text-destructive' :
          'text-muted-foreground'
        }>
          {message}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {!isScanning && scanStatus !== 'success' && (
          <Button onClick={startCamera} className="btn-scanner" disabled={isLoading}>
            <Camera className="w-4 h-4 mr-2" />
            START CAMERA
          </Button>
        )}
        
        {mode === 'verify' && isScanning && (
          <Button variant="outline" onClick={handleNoMatch}>
            NOT FOUND - MANUAL ENTRY
          </Button>
        )}
        
        <Button variant="outline" onClick={handleCancel}>
          CANCEL
        </Button>
      </div>
    </motion.div>
  );
}
