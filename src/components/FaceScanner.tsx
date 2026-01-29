/**
 * FaceScanner Component - Server-side biometrics
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBiometrics, captureFrame } from '@/hooks/useBiometrics';

interface FaceScannerProps {
  mode: 'enroll' | 'verify' | 'match';
  visitorId?: string;
  onSuccess?: (result: { success: boolean; visitorId?: string; score?: number; message: string }) => void;
  onError?: (error: string) => void;
  onCapture?: (imageBase64: string) => void;
}

export function FaceScanner({ mode, visitorId, onSuccess, onError, onCapture }: FaceScannerProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('Position face in camera');
  const [streamActive, setStreamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { analyzeQuality, verify, match } = useBiometrics();

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setStreamActive(true); }
      } catch { setStatus('error'); setMessage('Camera access denied'); }
    };
    start();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const performScan = useCallback(async () => {
    if (!videoRef.current || !streamActive) return;
    setStatus('scanning'); setMessage('Capturing...');
    const frame = captureFrame(videoRef.current);
    if (!frame) { setStatus('error'); setMessage('Capture failed'); onError?.('Capture failed'); return; }
    onCapture?.(frame);
    setStatus('processing'); setMessage('Analyzing...');
    const quality = await analyzeQuality(frame);
    if (!quality.data?.ok) { setStatus('error'); setMessage(quality.data?.reason || 'Quality check failed'); onError?.('Quality failed'); return; }
    if (mode === 'verify' && visitorId) {
      const r = await verify(visitorId, frame);
      if (r.data?.match) { setStatus('success'); setMessage('Verified'); onSuccess?.({ success: true, visitorId, score: r.data.score, message: 'Verified' }); }
      else { setStatus('error'); setMessage('No match'); onError?.('Verification failed'); }
    } else if (mode === 'match') {
      const r = await match(frame);
      if (r.data?.best_match?.decision === 'match') { setStatus('success'); setMessage('Match found'); onSuccess?.({ success: true, visitorId: r.data.best_match.visitor_id, score: r.data.best_match.score, message: 'Match' }); }
      else { setStatus('error'); setMessage('No match'); onError?.('No match'); }
    } else { setStatus('success'); setMessage('Captured'); onSuccess?.({ success: true, message: 'Ready' }); }
  }, [mode, visitorId, streamActive, analyzeQuality, verify, match, onSuccess, onError, onCapture]);

  return (
    <div className="relative aspect-video bg-muted rounded-xl overflow-hidden border-2 border-border">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div className={`w-48 h-60 rounded-full border-4 ${status === 'success' ? 'border-success' : status === 'error' ? 'border-destructive' : 'border-primary/50'}`} />
      </div>
      <div className="absolute bottom-4 left-4 right-4 p-3 rounded-lg bg-background/80 backdrop-blur-sm flex items-center gap-2">
        {status === 'idle' && <Camera className="w-5 h-5" />}
        {(status === 'scanning' || status === 'processing') && <Loader2 className="w-5 h-5 animate-spin" />}
        {status === 'success' && <CheckCircle className="w-5 h-5 text-success" />}
        {status === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
        <span className="text-sm">{message}</span>
      </div>
      {status === 'idle' && <Button onClick={performScan} className="absolute top-4 right-4 btn-scanner"><Camera className="w-4 h-4 mr-2" />SCAN</Button>}
      {(status === 'success' || status === 'error') && <Button onClick={() => { setStatus('idle'); setMessage('Position face'); }} variant="outline" className="absolute top-4 right-4">Retry</Button>}
    </div>
  );
}

export default FaceScanner;
