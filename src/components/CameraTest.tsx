import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, CheckCircle2, XCircle, RefreshCw, Loader2, 
  Video, Monitor, AlertTriangle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { checkBiometricsHealth, checkQuality } from '@/lib/api/biometrics';
type TestStatus = 'idle' | 'testing' | 'passed' | 'failed';

interface TestResult {
  name: string;
  status: TestStatus;
  message: string;
  duration?: number;
}

export function CameraTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [streamActive, setStreamActive] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Camera Access', status: 'idle', message: 'Not tested' },
    { name: 'Video Stream', status: 'idle', message: 'Not tested' },
    { name: 'Biometrics Service', status: 'idle', message: 'Not tested' },
    { name: 'Image Quality', status: 'idle', message: 'Not tested' },
    { name: 'Face Detection', status: 'idle', message: 'Not tested' },
  ]);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const updateTest = useCallback((index: number, update: Partial<TestResult>) => {
    setTests(prev => prev.map((t, i) => i === index ? { ...t, ...update } : t));
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  // Enumerate camera devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(t => t.stop());
        
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    }
    loadDevices();
  }, []);

  // Check biometrics service health on mount
  useEffect(() => {
    async function checkHealth() {
      const result = await checkBiometricsHealth();
      setBiometricsAvailable(result.ok);
    }
    checkHealth();
  }, []);

  const startCamera = useCallback(async (deviceId?: string): Promise<boolean> => {
    try {
      stopCamera();
      
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamActive(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Camera access error:', err);
      return false;
    }
  }, [stopCamera]);

  // Capture frame from video as base64
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]; // Return base64 only
  }, []);

  const runTests = async () => {
    setIsRunning(true);
    setOverallProgress(0);
    
    // Reset tests
    setTests(prev => prev.map(t => ({ ...t, status: 'idle', message: 'Waiting...' })));
    
    // Test 1: Camera Access
    updateTest(0, { status: 'testing', message: 'Checking camera permissions...' });
    const startTime1 = Date.now();
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const cameras = allDevices.filter(d => d.kind === 'videoinput');
      if (cameras.length === 0) throw new Error('No cameras found');
      updateTest(0, { 
        status: 'passed', 
        message: `${cameras.length} camera(s) detected`,
        duration: Date.now() - startTime1
      });
    } catch (err) {
      updateTest(0, { status: 'failed', message: String(err) });
      setIsRunning(false);
      return;
    }
    setOverallProgress(20);

    // Test 2: Video Stream
    updateTest(1, { status: 'testing', message: 'Starting video stream...' });
    const startTime2 = Date.now();
    const streamSuccess = await startCamera(selectedDeviceId);
    if (streamSuccess) {
      updateTest(1, { 
        status: 'passed', 
        message: 'Video stream active',
        duration: Date.now() - startTime2
      });
    } else {
      updateTest(1, { status: 'failed', message: 'Failed to start video stream' });
      setIsRunning(false);
      return;
    }
    setOverallProgress(40);

    // Wait for video to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 3: Biometrics Service Health
    updateTest(2, { status: 'testing', message: 'Connecting to biometrics server...' });
    const startTime3 = Date.now();
    const healthResult = await checkBiometricsHealth();
    if (healthResult.ok && healthResult.data) {
      updateTest(2, { 
        status: 'passed', 
        message: `Server v${healthResult.data.version} - Models loaded`,
        duration: Date.now() - startTime3
      });
      setBiometricsAvailable(true);
    } else {
      updateTest(2, { 
        status: 'failed', 
        message: healthResult.error || 'Cannot connect to biometrics server'
      });
      setBiometricsAvailable(false);
      // Continue anyway - other tests can still run
    }
    setOverallProgress(60);

    // Test 4: Image Quality Check
    updateTest(3, { status: 'testing', message: 'Analyzing image quality...' });
    const startTime4 = Date.now();
    const frame = captureFrame();
    if (frame && biometricsAvailable !== false) {
      const qualityResult = await checkQuality(frame);
      if (qualityResult.ok && qualityResult.data) {
        const data = qualityResult.data;
        if (data.ok) {
          updateTest(3, { 
            status: 'passed', 
            message: `Quality score: ${(data.overall_score * 100).toFixed(0)}%`,
            duration: Date.now() - startTime4
          });
        } else {
          updateTest(3, { 
            status: 'failed', 
            message: data.reason || 'Quality check failed'
          });
        }
      } else {
        updateTest(3, { 
          status: 'failed', 
          message: qualityResult.error || 'Quality check unavailable'
        });
      }
    } else if (!frame) {
      updateTest(3, { status: 'failed', message: 'Failed to capture frame' });
    } else {
      updateTest(3, { status: 'failed', message: 'Biometrics server unavailable' });
    }
    setOverallProgress(80);

    // Test 5: Face Detection (via quality endpoint which includes detection)
    updateTest(4, { status: 'testing', message: 'Detecting face in frame...' });
    const startTime5 = Date.now();
    const frame2 = captureFrame();
    if (frame2 && biometricsAvailable !== false) {
      const qualityResult = await checkQuality(frame2);
      if (qualityResult.ok && qualityResult.data) {
        const data = qualityResult.data;
        if (data.metrics.num_faces === 1) {
          const confidence = (data.face_confidence * 100).toFixed(0);
          updateTest(4, { 
            status: 'passed', 
            message: `Face detected (${confidence}% confidence)`,
            duration: Date.now() - startTime5
          });
        } else if (data.metrics.num_faces === 0) {
          updateTest(4, { 
            status: 'failed', 
            message: 'No face detected - position face in camera view'
          });
        } else {
          updateTest(4, { 
            status: 'failed', 
            message: `Multiple faces (${data.metrics.num_faces}) - only one face allowed`
          });
        }
      } else {
        updateTest(4, { status: 'failed', message: 'Detection unavailable' });
      }
    } else if (!frame2) {
      updateTest(4, { status: 'failed', message: 'Failed to capture frame' });
    } else {
      updateTest(4, { status: 'failed', message: 'Biometrics server unavailable' });
    }
    
    setOverallProgress(100);
    setIsRunning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const passedTests = tests.filter(t => t.status === 'passed').length;
  const failedTests = tests.filter(t => t.status === 'failed').length;
  const allPassed = passedTests === tests.length;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          CAMERA & FACE DETECTION TEST
        </CardTitle>
        <CardDescription>
          Verify camera and biometric systems before enrollment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Camera Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-xl overflow-hidden border-2 border-border">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!streamActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Camera preview</p>
                  </div>
                </div>
              )}
              {streamActive && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-success/90 text-success-foreground">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse mr-2" />
                    LIVE
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">SELECT CAMERA</label>
              <Select 
                value={selectedDeviceId} 
                onValueChange={(deviceId) => {
                  setSelectedDeviceId(deviceId);
                  if (streamActive) {
                    startCamera(deviceId);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <Camera className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Select a camera" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device, index) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={runTests} 
              disabled={isRunning}
              className="w-full btn-scanner"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  RUNNING TESTS...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  RUN DIAGNOSTIC TESTS
                </>
              )}
            </Button>
          </div>

          {/* Test Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">TEST RESULTS</h3>
              {overallProgress > 0 && (
                <Badge variant={allPassed ? 'default' : failedTests > 0 ? 'destructive' : 'secondary'}>
                  {passedTests}/{tests.length} PASSED
                </Badge>
              )}
            </div>

            {isRunning && (
              <Progress value={overallProgress} className="h-2" />
            )}

            <div className="space-y-2">
              {tests.map((test, index) => (
                <motion.div
                  key={test.name}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border
                    ${test.status === 'passed' ? 'bg-success/10 border-success/30' :
                      test.status === 'failed' ? 'bg-destructive/10 border-destructive/30' :
                      test.status === 'testing' ? 'bg-info/10 border-info/30' :
                      'bg-muted/30 border-border/50'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {test.status === 'testing' ? (
                      <Loader2 className="w-5 h-5 text-info animate-spin" />
                    ) : test.status === 'passed' ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : test.status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-destructive" />
                    ) : (
                      <Monitor className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm text-foreground">{test.name}</p>
                      <p className="text-xs text-muted-foreground">{test.message}</p>
                    </div>
                  </div>
                  {test.duration && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {test.duration}ms
                    </span>
                  )}
                </motion.div>
              ))}
            </div>

            {allPassed && overallProgress === 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-lg bg-success/10 border border-success/30"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  <div>
                    <p className="font-semibold text-success">ALL TESTS PASSED</p>
                    <p className="text-sm text-muted-foreground">
                      Camera and face detection are ready for enrollment
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {failedTests > 0 && !isRunning && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-lg bg-destructive/10 border border-destructive/30"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive">SOME TESTS FAILED</p>
                    <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                      <li>• Ensure good lighting conditions</li>
                      <li>• Position face clearly in camera view</li>
                      <li>• Check browser camera permissions</li>
                      <li>• Try a different camera device</li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={runTests}
                      className="mt-3"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry Tests
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
