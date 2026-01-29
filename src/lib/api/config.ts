/**
 * API Configuration
 * 
 * Centralized configuration for backend API endpoints.
 * Supports both development and production environments.
 */

export interface APIConfig {
  baseUrl: string;
  biometricsUrl: string;
  timeout: number;
  retryAttempts: number;
}

// Default configuration - can be overridden via settings
const DEFAULT_CONFIG: APIConfig = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  biometricsUrl: import.meta.env.VITE_BIOMETRICS_URL || 'http://localhost:8000',
  timeout: 30000,
  retryAttempts: 3,
};

let currentConfig: APIConfig = { ...DEFAULT_CONFIG };

export function getAPIConfig(): APIConfig {
  return { ...currentConfig };
}

export function setAPIConfig(config: Partial<APIConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  // Persist to localStorage for PWA offline access
  localStorage.setItem('watchguard_api_config', JSON.stringify(currentConfig));
}

export function loadAPIConfig(): void {
  try {
    const stored = localStorage.getItem('watchguard_api_config');
    if (stored) {
      currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    console.warn('Failed to load API config from storage');
  }
}

// Initialize on module load
loadAPIConfig();
