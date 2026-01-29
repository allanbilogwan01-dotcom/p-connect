/**
 * WatchGuard Frontend Configuration
 * 
 * API endpoint configuration for connecting to backend server.
 */

// Detect environment and set API URL
const getApiUrl = (): string => {
  // Check for environment variable (Vite)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Check localStorage for saved API URL
  const savedUrl = localStorage.getItem('watchguard_api_url');
  if (savedUrl) {
    return savedUrl;
  }
  
  // Default based on current host
  const host = window.location.hostname;
  
  // Development
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // Production - assume API is on same host
  return `${window.location.protocol}//${host}/api`;
};

// Biometrics service URL
const getBiometricsUrl = (): string => {
  if (import.meta.env.VITE_BIOMETRICS_URL) {
    return import.meta.env.VITE_BIOMETRICS_URL;
  }
  
  const savedUrl = localStorage.getItem('watchguard_biometrics_url');
  if (savedUrl) {
    return savedUrl;
  }
  
  const host = window.location.hostname;
  
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  // In production, biometrics goes through backend proxy
  return `${window.location.protocol}//${host}/api/biometrics`;
};

export const config = {
  apiUrl: getApiUrl(),
  biometricsUrl: getBiometricsUrl(),
  
  // Update URLs (useful for Settings page)
  setApiUrl: (url: string) => {
    localStorage.setItem('watchguard_api_url', url);
    window.location.reload();
  },
  
  setBiometricsUrl: (url: string) => {
    localStorage.setItem('watchguard_biometrics_url', url);
  },
  
  // Reset to defaults
  resetUrls: () => {
    localStorage.removeItem('watchguard_api_url');
    localStorage.removeItem('watchguard_biometrics_url');
    window.location.reload();
  },
};

export default config;
