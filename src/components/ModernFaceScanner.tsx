/**
 * ModernFaceScanner - Premium server-side biometrics UI
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, CheckCircle, XCircle, Shield, Scan, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBiometrics, captureFrame, captureFrameBurst } from '@/hooks/useBiometrics';

interface ModernFaceScannerProps {
  mode: 'enroll' | 'verify' | 'match';
  visitorId?: string;
  visitorName?: string;
  onSuccess?: (result: { success: boolean; visitorId?: string; score?: number; message: string }) => void;
  onError?: (error: string) => void;
  onFrameCapture?: (frames: string[]) => void;
  requiredSamples?: number;
  className?: string;
}

export function ModernFaceScanner({ mode, visitorId, visitorName, onSuccess, onError, onFrameCapture, requiredSamples = 5, className = '' }: ModernFaceScannerProps) {
  const [phase, setPhase] = useState<'init' | 'ready' | 'scanning' | 'processing' | 'success' | 'error'>('init');
  const [message, setMessage] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [streamActive, setStreamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { isHealthy, checkHealth, analyzeQuality, enroll, verify, match, detectLiveness } = useBiometrics();

  useEffect(() => {
    const init = async () => {
      await checkHealth();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setStreamActive(true); setPhase('ready'); setMessage('Position face in frame'); }
      } catch { setPhase('error'); setMessage('Camera denied'); }
    };
    init();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [checkHealth]);

  const startScan = useCallback(async () => {
    if (!videoRef.current) return;
    setPhase('scanning'); setProgress(0);
    if (mode === 'enroll') {
      const frames: string[] = [];
      for (let i = 0; i < requiredSamples; i++) {
        setMessage(`Sample ${i + 1}/${requiredSamples}`);
        await new Promise(r => setTimeout(r, 600));
        const f = captureFrame(videoRef.current!);
        if (f) { const q = await analyzeQuality(f); if (q.data?.ok) { frames.push(f); setProgress(((i + 1) / requiredSamples) * 100); } else i--; }
      }
      onFrameCapture?.(frames);
      setPhase('processing'); setMessage('Enrolling...');
      const r = await enroll(visitorId!, frames);
      if (r.success) { setPhase('success'); setMessage('Enrolled'); onSuccess?.({ success: true, visitorId, message: 'Enrolled' }); }
      else { setPhase('error'); setMessage(r.error || 'Failed'); onError?.(r.error || 'Failed'); }
    } else if (mode === 'verify') {
      setMessage('Verifying...');
      const f = captureFrame(videoRef.current);
      if (!f) { setPhase('error'); setMessage('Capture failed'); return; }
      setPhase('processing');
      const r = await verify(visitorId!, f);
      if (r.data?.match) { setPhase('success'); setMessage('Verified'); onSuccess?.({ success: true, visitorId, score: r.data.score, message: 'Verified' }); }
      else { setPhase('error'); setMessage('No match'); onError?.('Failed'); }
    } else {
      setMessage('Matching...');
      const f = captureFrame(videoRef.current);
      if (!f) { setPhase('error'); setMessage('Capture failed'); return; }
      setPhase('processing');
      const r = await match(f);
      if (r.data?.best_match?.decision === 'match') { setPhase('success'); setMessage('Found'); onSuccess?.({ success: true, visitorId: r.data.best_match.visitor_id, score: r.data.best_match.score, message: 'Match' }); }
      else { setPhase('error'); setMessage('No match'); onError?.('No match'); }
    }
  }, [mode, visitorId, requiredSamples, analyzeQuality, enroll, verify, match, onSuccess, onError, onFrameCapture]);

  const styles = phase === 'success' ? 'border-success bg-success/10' : phase === 'error' ? 'border-destructive bg-destructive/10' : 'border-primary/50 bg-primary/10';

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}>
      <div className="relative aspect-[4/3] bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div className={`w-52 h-64 rounded-[40%] border-4 ${styles}`} animate={{ scale: phase === 'scanning' ? [1, 1.02, 1] : 1 }} transition={{ repeat: phase === 'scanning' ? Infinity : 0, duration: 1.5 }} />
        </div>
        <div className="absolute top-4 left-4"><Badge variant="outline" className="bg-background/80">{mode === 'enroll' ? <User className="w-3 h-3 mr-1" /> : mode === 'verify' ? <Shield className="w-3 h-3 mr-1" /> : <Scan className="w-3 h-3 mr-1" />}{mode.toUpperCase()}</Badge></div>
        <div className="absolute top-4 right-4"><Badge variant="outline" className={`bg-background/80 ${isHealthy ? 'text-success' : 'text-destructive'}`}><span className={`w-2 h-2 rounded-full mr-2 ${isHealthy ? 'bg-success' : 'bg-destructive'}`} />{isHealthy ? 'READY' : 'OFFLINE'}</Badge></div>
        {mode === 'enroll' && phase === 'scanning' && <div className="absolute bottom-20 left-4 right-4"><Progress value={progress} className="h-2" /></div>}
      </div>
      <div className={`p-4 ${styles}`}>
        <div className="flex items-center gap-3">
          {phase === 'init' && <Loader2 className="w-6 h-6 animate-spin" />}
          {phase === 'ready' && <Camera className="w-6 h-6 text-primary" />}
          {(phase === 'scanning' || phase === 'processing') && <Loader2 className="w-6 h-6 animate-spin" />}
          {phase === 'success' && <CheckCircle className="w-6 h-6 text-success" />}
          {phase === 'error' && <XCircle className="w-6 h-6 text-destructive" />}
          <div className="flex-1"><p className="font-semibold">{message}</p></div>
          {phase === 'ready' && <Button onClick={startScan} disabled={!isHealthy} className="btn-scanner"><Zap className="w-4 h-4 mr-2" />START</Button>}
          {(phase === 'success' || phase === 'error') && <Button onClick={() => { setPhase('ready'); setMessage('Position face'); setProgress(0); }} variant="outline">Retry</Button>}
        </div>
      </div>
    </div>
  );
}

export default ModernFaceScanner;
