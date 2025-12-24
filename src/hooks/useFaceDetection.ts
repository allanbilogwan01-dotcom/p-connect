import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

type FaceDetectionState = {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
};

const MODEL_URL = '/models';

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
      // Load models from CDN if not available locally
      const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
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
      const detection = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      
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
      const detections = await faceapi
        .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions())
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
    return Math.max(0, 1 - distance);
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
