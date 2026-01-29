/**
 * Biometrics API Client
 * 
 * Handles all biometric operations via server-side ArcFace/ONNX pipeline.
 * NO client-side face detection - all processing is server-side.
 * 
 * The biometrics service uses:
 * - YuNet ONNX for face detection
 * - ArcFace ONNX (w600k_r50) for face embedding
 * 
 * Embeddings are NEVER exposed to the client.
 */

import { getAPIConfig } from './config';
import { getAuthToken } from './client';

export interface QualityMetrics {
  num_faces: number;
  det_score: number;
  blur: number;
  brightness: number;
  face_size: number;
}

export interface QualityResult {
  ok: boolean;
  reason: string;
  metrics: QualityMetrics;
  overall_score: number;
  face_confidence: number;
}

export interface EnrollResult {
  ok: boolean;
  subject_id: string;
  samples_processed: number;
  template_id: string;
  message: string;
}

export interface MatchCandidate {
  subject_id: string;
  visitor_id: string;
  score: number;
  decision: 'match' | 'no_match';
}

export interface MatchResult {
  ok: boolean;
  candidates: MatchCandidate[];
  best_match: MatchCandidate | null;
  message: string;
}

export interface VerifyResult {
  ok: boolean;
  match: boolean;
  score: number;
  decision: 'pass' | 'fail';
  message: string;
}

export interface LivenessResult {
  ok: boolean;
  live: boolean;
  score: number;
  checks: {
    blink_detected: boolean;
    head_movement: boolean;
    texture_analysis: boolean;
  };
  message: string;
}

export interface BiometricsHealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  version: string;
  models_loaded: boolean;
  detector: string;
  recognizer: string;
  uptime_seconds: number;
}

// Biometrics service is proxied through the main API
const BIOMETRICS_PREFIX = '/biometrics';

async function biometricsRequest<T>(
  endpoint: string,
  body?: unknown
): Promise<{ data: T | null; error: string | null; ok: boolean }> {
  const config = getAPIConfig();
  const url = `${config.baseUrl}${BIOMETRICS_PREFIX}${endpoint}`;
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: json.message || json.error || 'Biometrics service error',
        ok: false,
      };
    }

    return { data: json as T, error: null, ok: true };
  } catch (err) {
    const error = err as Error;
    return {
      data: null,
      error: error.message || 'Failed to connect to biometrics service',
      ok: false,
    };
  }
}

/**
 * Check biometrics service health
 */
export async function checkBiometricsHealth(): Promise<{
  data: BiometricsHealthStatus | null;
  error: string | null;
  ok: boolean;
}> {
  const config = getAPIConfig();
  
  try {
    const response = await fetch(`${config.baseUrl}${BIOMETRICS_PREFIX}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return {
        data: null,
        error: 'Biometrics service unavailable',
        ok: false,
      };
    }

    const data = await response.json();
    return { data, error: null, ok: true };
  } catch {
    return {
      data: null,
      error: 'Cannot connect to biometrics service',
      ok: false,
    };
  }
}

/**
 * Check image quality for biometric enrollment
 * 
 * @param imageBase64 - Base64 encoded image (JPEG/PNG)
 * @returns Quality assessment result
 */
export async function checkQuality(
  imageBase64: string
): Promise<{ data: QualityResult | null; error: string | null; ok: boolean }> {
  return biometricsRequest<QualityResult>('/quality', { imageBase64 });
}

/**
 * Enroll visitor biometrics
 * 
 * Requires multiple samples (minimum 3, recommended 5) for robust enrollment.
 * Samples should include different angles: front, left, right, up, down.
 * 
 * @param visitorId - Visitor ID to enroll
 * @param samples - Array of base64 encoded images
 */
export async function enrollVisitor(
  visitorId: string,
  samples: string[]
): Promise<{ data: EnrollResult | null; error: string | null; ok: boolean }> {
  if (samples.length < 3) {
    return {
      data: null,
      error: 'Minimum 3 samples required for enrollment',
      ok: false,
    };
  }

  return biometricsRequest<EnrollResult>('/enroll', {
    subjectType: 'visitor',
    subjectId: visitorId,
    samples,
  });
}

/**
 * Match face against enrolled visitors
 * 
 * @param imageBase64 - Base64 encoded image to match
 * @param topK - Maximum number of candidates to return (default: 5)
 */
export async function matchFace(
  imageBase64: string,
  topK: number = 5
): Promise<{ data: MatchResult | null; error: string | null; ok: boolean }> {
  return biometricsRequest<MatchResult>('/match', {
    subjectType: 'visitor',
    imageBase64,
    topK,
  });
}

/**
 * Verify face against specific enrolled visitor
 * 
 * @param visitorId - Visitor ID to verify against
 * @param imageBase64 - Base64 encoded image to verify
 */
export async function verifyFace(
  visitorId: string,
  imageBase64: string
): Promise<{ data: VerifyResult | null; error: string | null; ok: boolean }> {
  return biometricsRequest<VerifyResult>('/verify', {
    subjectType: 'visitor',
    subjectId: visitorId,
    imageBase64,
  });
}

/**
 * Perform liveness detection
 * 
 * Requires multiple frames (burst) to detect motion and prevent spoofing.
 * 
 * @param frames - Array of base64 encoded frames (minimum 5)
 */
export async function checkLiveness(
  frames: string[]
): Promise<{ data: LivenessResult | null; error: string | null; ok: boolean }> {
  if (frames.length < 5) {
    return {
      data: null,
      error: 'Minimum 5 frames required for liveness detection',
      ok: false,
    };
  }

  return biometricsRequest<LivenessResult>('/liveness', { frames });
}

/**
 * Delete visitor biometric template
 * 
 * @param visitorId - Visitor ID to delete
 */
export async function deleteEnrollment(
  visitorId: string
): Promise<{ error: string | null; ok: boolean }> {
  const result = await biometricsRequest<{ ok: boolean }>('/delete', {
    subjectType: 'visitor',
    subjectId: visitorId,
  });
  return { error: result.error, ok: result.ok };
}

/**
 * Check if visitor has enrolled biometrics
 * 
 * @param visitorId - Visitor ID to check
 */
export async function hasEnrollment(
  visitorId: string
): Promise<boolean> {
  const result = await biometricsRequest<{ enrolled: boolean }>('/check', {
    subjectType: 'visitor',
    subjectId: visitorId,
  });
  return result.data?.enrolled ?? false;
}
