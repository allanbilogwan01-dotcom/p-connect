import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CameraSelectorProps {
  onStream: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  autoStart?: boolean;
  className?: string;
}

export function useCameraDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
        s.getTracks().forEach(t => t.stop());
      });
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  }, [selectedDevice]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  return { devices, selectedDevice, setSelectedDevice, refreshDevices, isLoading, setIsLoading };
}

export function CameraSelector({ 
  onStream, 
  onError,
  autoStart = true,
  className = ''
}: CameraSelectorProps) {
  const { devices, selectedDevice, setSelectedDevice, refreshDevices, isLoading, setIsLoading } = useCameraDevices();
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async (deviceId?: string) => {
    setIsLoading(true);
    try {
      // Stop existing stream
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
      onStream(stream);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [onStream, onError, setIsLoading]);

  useEffect(() => {
    if (autoStart && selectedDevice) {
      startCamera(selectedDevice);
    }
  }, [selectedDevice, autoStart, startCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
    startCamera(deviceId);
  };

  if (devices.length <= 1) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={selectedDevice} onValueChange={handleDeviceChange}>
        <SelectTrigger className="w-[200px] h-9 text-sm bg-background/50 border-border/50">
          <Camera className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Select camera" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device, index) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={refreshDevices}
        className="h-9 w-9"
      >
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default CameraSelector;
