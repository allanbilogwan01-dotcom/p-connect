/**
 * Server-side Biometrics Hook
 * 
 * Provides biometric operations via server-side ArcFace/ONNX pipeline.
 * All processing happens on the backend - no client-side face detection.
 */

import { useState, useCallback } from 'react';
import {
  checkBiometricsHealth,
  checkQuality,
  enrollVisitor,
  verifyFace,
  matchFace,
  checkLiveness,
  hasEnrollment,
  type QualityResult,
  type VerifyResult,
  type MatchResult,
  type LivenessResult,
  type BiometricsHealthStatus,
} from '@/lib/api/biometrics';

interface BiometricsState {
  isLoading: boolean;
  isHealthy: boolean | null;
  error: string | null;
}

export function useBiometrics() {
  const [state, setState] = useState<BiometricsState>({
    isLoading: false,
    isHealthy: null,
    error: null,
  });

  /**
   * Check if biometrics service is available
   */
  const checkHealth = useCallback(async (): Promise<BiometricsHealthStatus | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await checkBiometricsHealth();
    
    if (result.ok && result.data) {
      setState({ isLoading: false, isHealthy: true, error: null });
      return result.data;
    } else {
      setState({ 
        isLoading: false, 
        isHealthy: false, 
        error: result.error || 'Biometrics service unavailable' 
      });
      return null;
    }
  }, []);

  /**
   * Check image quality for enrollment
   */
  const analyzeQuality = useCallback(async (
    imageBase64: string
  ): Promise<{ data: QualityResult | null; error: string | null }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await checkQuality(imageBase64);
    
    setState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.error 
    }));
    
    return { data: result.data, error: result.error };
  }, []);

  /**
   * Enroll visitor biometrics with multiple samples
   */
  const enroll = useCallback(async (
    visitorId: string,
    samples: string[]
  ): Promise<{ success: boolean; error: string | null }> => {
    if (samples.length < 3) {
      return { success: false, error: 'Minimum 3 samples required' };
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await enrollVisitor(visitorId, samples);
    
    setState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.error 
    }));
    
    return { 
      success: result.ok && result.data?.ok === true, 
      error: result.error 
    };
  }, []);

  /**
   * Verify face against enrolled visitor (1:1)
   */
  const verify = useCallback(async (
    visitorId: string,
    imageBase64: string
  ): Promise<{ data: VerifyResult | null; error: string | null }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await verifyFace(visitorId, imageBase64);
    
    setState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.error 
    }));
    
    return { data: result.data, error: result.error };
  }, []);

  /**
   * Match face against all enrolled visitors (1:N)
   */
  const match = useCallback(async (
    imageBase64: string,
    topK: number = 5
  ): Promise<{ data: MatchResult | null; error: string | null }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await matchFace(imageBase64, topK);
    
    setState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.error 
    }));
    
    return { data: result.data, error: result.error };
  }, []);

  /**
   * Check liveness with multiple frames
   */
  const detectLiveness = useCallback(async (
    frames: string[]
  ): Promise<{ data: LivenessResult | null; error: string | null }> => {
    if (frames.length < 5) {
      return { data: null, error: 'Minimum 5 frames required' };
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await checkLiveness(frames);
    
    setState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.error 
    }));
    
    return { data: result.data, error: result.error };
  }, []);

  /**
   * Check if visitor has enrolled biometrics
   */
  const checkEnrolled = useCallback(async (visitorId: string): Promise<boolean> => {
    return hasEnrollment(visitorId);
  }, []);

  return {
    ...state,
    checkHealth,
    analyzeQuality,
    enroll,
    verify,
    match,
    detectLiveness,
    checkEnrolled,
  };
}

/**
 * Capture frame from video element as base64 JPEG
 */
export function captureFrame(
  video: HTMLVideoElement,
  quality: number = 0.9
): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  
  // Return base64 without prefix
  return dataUrl.split(',')[1] || null;
}

/**
 * Capture multiple frames for liveness detection
 */
export async function captureFrameBurst(
  video: HTMLVideoElement,
  count: number = 5,
  intervalMs: number = 200
): Promise<string[]> {
  const frames: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const frame = captureFrame(video);
    if (frame) {
      frames.push(frame);
    }
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  return frames;
}
