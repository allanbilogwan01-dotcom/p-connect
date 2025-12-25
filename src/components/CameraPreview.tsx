import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCameraDevices } from '@/components/CameraSelector';
import { useCameraContext } from '@/hooks/useCameraContext';

interface CameraPreviewProps {
  onReady?: () => void;
  className?: string;
}

export function CameraPreview({ onReady, className = '' }: CameraPreviewProps) {
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();
  const { setActive: setCameraActive } = useCameraContext();

  const startPreview = useCallback(async () => {
    setIsLoading(true);
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 320 }, height: { ideal: 240 } }
          : { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setIsPreviewActive(true);
      setCameraActive(true);
      onReady?.();
    } catch (err) {
      console.error('Camera preview error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeviceId, onReady, setCameraActive]);

  const stopPreview = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsPreviewActive(false);
    setCameraActive(false);
  }, [setCameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Restart preview when device changes
  useEffect(() => {
    if (isPreviewActive && selectedDeviceId) {
      startPreview();
    }
  }, [selectedDeviceId]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Camera selector */}
      {devices.length > 1 && !isPreviewActive && (
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

      {/* Preview toggle button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={isPreviewActive ? stopPreview : startPreview}
          disabled={isLoading}
          className="gap-2"
        >
          {isPreviewActive ? (
            <>
              <EyeOff className="w-4 h-4" />
              Hide Preview
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Show Camera Preview
            </>
          )}
        </Button>
      </div>

      {/* Preview video */}
      <AnimatePresence>
        {isPreviewActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex justify-center"
          >
            <div className="relative w-48 h-36 rounded-xl overflow-hidden bg-muted border-2 border-primary/30">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={stopPreview}
                className="absolute top-1 right-1 w-6 h-6 bg-background/50 hover:bg-background/80"
              >
                <X className="w-3 h-3" />
              </Button>
              <div className="absolute bottom-1 left-0 right-0 text-center">
                <span className="bg-background/70 text-foreground text-xs px-2 py-0.5 rounded-full">
                  Preview
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
