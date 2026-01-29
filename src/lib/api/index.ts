/**
 * API Module Exports
 * 
 * Centralized exports for all API functionality.
 */

// Core client
export { api, request, setAuthToken, getAuthToken, onConnectionChange, getConnectionStatus } from './client';
export type { APIError, APIResponse } from './client';

// Configuration
export { getAPIConfig, setAPIConfig, loadAPIConfig } from './config';
export type { APIConfig } from './config';

// Biometrics
export {
  checkBiometricsHealth,
  checkQuality,
  enrollVisitor,
  matchFace,
  verifyFace,
  checkLiveness,
  deleteEnrollment,
  hasEnrollment,
} from './biometrics';
export type {
  QualityMetrics,
  QualityResult,
  EnrollResult,
  MatchCandidate,
  MatchResult,
  VerifyResult,
  LivenessResult,
  BiometricsHealthStatus,
} from './biometrics';

// Domain API modules
export * from './auth';
export * from './settings';
export * from './pdl';
export * from './visitors';
export * from './visits';
export * from './audit';
