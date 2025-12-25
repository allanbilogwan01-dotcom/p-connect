import { useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

type FaceDetectionState = {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
};

export function useFaceDetection() {
  const [state, setState] = useState<FaceDetectionState>({
    isLoaded: false,
    isLoading: false,
    error: null,
  });
  const loadedRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (loadedRef.current || state.isLoading) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Load models from CDN - using more accurate models for better recognition
      const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      
      await Promise.all([
        // Use SSD MobileNet for better detection accuracy (vs TinyFaceDetector)
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
        // Load landmark model for face alignment
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
        // Load recognition model for face descriptors
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
        // Also load tiny face detector as fallback
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      ]);
      
      loadedRef.current = true;
      setState({ isLoaded: true, isLoading: false, error: null });
    } catch (err) {
      console.error('Failed to load face-api models:', err);
      setState({ isLoaded: false, isLoading: false, error: 'Failed to load face detection models' });
    }
  }, [state.isLoading]);

  const detectFace = useCallback(async (
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null> => {
    if (!state.isLoaded) {
      console.warn('Models not loaded yet');
      return null;
    }

    try {
      // Use SSD MobileNet for more accurate detection
      // Set minConfidence higher for better quality detections
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      
      let detection = await faceapi
        .detectSingleFace(input, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      // Fallback to TinyFaceDetector if SSD doesn't find a face
      if (!detection) {
        const tinyOptions = new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 512,  // Higher input size for better accuracy
          scoreThreshold: 0.5 
        });
        detection = await faceapi
          .detectSingleFace(input, tinyOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();
      }
      
      return detection || null;
    } catch (err) {
      console.error('Face detection error:', err);
      return null;
    }
  }, [state.isLoaded]);

  const detectAllFaces = useCallback(async (
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ) => {
    if (!state.isLoaded) {
      console.warn('Models not loaded yet');
      return [];
    }

    try {
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      
      const detections = await faceapi
        .detectAllFaces(input, options)
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      return detections;
    } catch (err) {
      console.error('Face detection error:', err);
      return [];
    }
  }, [state.isLoaded]);

  const compareFaces = useCallback((
    descriptor1: Float32Array,
    descriptor2: Float32Array
  ): number => {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }, []);

  const getMatchScore = useCallback((distance: number): number => {
    // Convert euclidean distance to similarity score (0-1)
    // Lower distance = higher similarity
    // Using a more aggressive curve for better discrimination
    // Typical face-api distances: 
    // - Same person: 0.3 - 0.5
    // - Different person: 0.6+
    if (distance <= 0.35) return 1.0;
    if (distance >= 0.8) return 0.0;
    
    // Smooth transition between thresholds
    return Math.max(0, 1 - (distance / 0.6));
  }, []);

  return {
    ...state,
    loadModels,
    detectFace,
    detectAllFaces,
    compareFaces,
    getMatchScore,
  };
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

export function arrayToDescriptor(array: number[]): Float32Array {
  return new Float32Array(array);
}
