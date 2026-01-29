/**
 * API Client
 * 
 * Production-grade HTTP client with:
 * - Automatic retry with exponential backoff
 * - Request timeout handling
 * - Authentication token management
 * - Offline detection and queuing
 * - Error normalization
 */

import { getAPIConfig } from './config';

export interface APIError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

export interface APIResponse<T> {
  data: T | null;
  error: APIError | null;
  ok: boolean;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeout?: number;
  skipAuth?: boolean;
}

// Connection state
let isOnline = navigator.onLine;
let connectionListeners: ((online: boolean) => void)[] = [];

window.addEventListener('online', () => {
  isOnline = true;
  connectionListeners.forEach(cb => cb(true));
});

window.addEventListener('offline', () => {
  isOnline = false;
  connectionListeners.forEach(cb => cb(false));
});

export function onConnectionChange(callback: (online: boolean) => void): () => void {
  connectionListeners.push(callback);
  return () => {
    connectionListeners = connectionListeners.filter(cb => cb !== callback);
  };
}

export function getConnectionStatus(): boolean {
  return isOnline;
}

// Token management
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem('watchguard_auth_token', token);
  } else {
    localStorage.removeItem('watchguard_auth_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('watchguard_auth_token');
  }
  return authToken;
}

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Exponential backoff delay
function getBackoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 10000);
}

// Main request function
export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<APIResponse<T>> {
  const config = getAPIConfig();
  const { body, timeout = config.timeout, skipAuth = false, ...fetchOptions } = options;

  // Check online status
  if (!isOnline) {
    return {
      data: null,
      error: {
        code: 'OFFLINE',
        message: 'No network connection. Please check your connection and try again.',
        status: 0,
      },
      ok: false,
    };
  }

  const url = `${config.baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  // Add auth token if available
  const token = getAuthToken();
  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  // Retry loop
  for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, requestOptions, timeout);

      // Parse response
      let data: T | null = null;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const json = await response.json();
        if (response.ok) {
          data = json.data ?? json;
        } else {
          return {
            data: null,
            error: {
              code: json.code || 'API_ERROR',
              message: json.message || response.statusText,
              status: response.status,
              details: json.details,
            },
            ok: false,
          };
        }
      }

      if (!response.ok) {
        return {
          data: null,
          error: {
            code: 'HTTP_ERROR',
            message: response.statusText,
            status: response.status,
          },
          ok: false,
        };
      }

      return { data, error: null, ok: true };
    } catch (err) {
      const error = err as Error;

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        return {
          data: null,
          error: {
            code: 'TIMEOUT',
            message: 'Request timed out. Please try again.',
            status: 0,
          },
          ok: false,
        };
      }

      // Don't retry on last attempt
      if (attempt === config.retryAttempts - 1) {
        return {
          data: null,
          error: {
            code: 'NETWORK_ERROR',
            message: error.message || 'Network request failed',
            status: 0,
          },
          ok: false,
        };
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, getBackoffDelay(attempt)));
    }
  }

  // Should never reach here
  return {
    data: null,
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      status: 0,
    },
    ok: false,
  };
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
