/**
 * Centralized API Client
 * 
 * This module provides a unified interface for all data operations.
 * Currently uses localStorage, but can be switched to REST API endpoints
 * when the PHP backend is ready.
 */

import * as localStorage from './localStorage';

// Configuration
const API_CONFIG = {
  useRestApi: false, // Set to true when PHP backend is ready
  baseUrl: '/api', // Base URL for REST API
};

// Generic request handler
async function request<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: unknown
): Promise<T> {
  if (!API_CONFIG.useRestApi) {
    throw new Error('REST API not enabled');
  }

  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// ============= User Operations =============
export const users = {
  getAll: () => {
    if (API_CONFIG.useRestApi) {
      return request('/users');
    }
    return Promise.resolve(localStorage.getUsers());
  },
  
  getById: (id: string) => {
    if (API_CONFIG.useRestApi) {
      return request(`/users/${id}`);
    }
    return Promise.resolve(localStorage.getUserById(id));
  },
  
  create: (userData: Parameters<typeof localStorage.createUser>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/users', 'POST', userData);
    }
    return Promise.resolve(localStorage.createUser(userData));
  },
  
  update: (id: string, updates: Parameters<typeof localStorage.updateUser>[1]) => {
    if (API_CONFIG.useRestApi) {
      return request(`/users/${id}`, 'PUT', updates);
    }
    return Promise.resolve(localStorage.updateUser(id, updates));
  },
  
  verifyPassword: (username: string, password: string) => {
    if (API_CONFIG.useRestApi) {
      return request('/auth/verify', 'POST', { username, password });
    }
    return Promise.resolve(localStorage.verifyPassword(username, password));
  },
};

// ============= PDL Operations =============
export const pdls = {
  getAll: () => {
    if (API_CONFIG.useRestApi) {
      return request('/pdls');
    }
    return Promise.resolve(localStorage.getPDLs());
  },
  
  getById: (id: string) => {
    if (API_CONFIG.useRestApi) {
      return request(`/pdls/${id}`);
    }
    return Promise.resolve(localStorage.getPDLById(id));
  },
  
  create: (pdlData: Parameters<typeof localStorage.createPDL>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/pdls', 'POST', pdlData);
    }
    return Promise.resolve(localStorage.createPDL(pdlData));
  },
  
  update: (id: string, updates: Parameters<typeof localStorage.updatePDL>[1]) => {
    if (API_CONFIG.useRestApi) {
      return request(`/pdls/${id}`, 'PUT', updates);
    }
    return Promise.resolve(localStorage.updatePDL(id, updates));
  },
};

// ============= Visitor Operations =============
export const visitors = {
  getAll: () => {
    if (API_CONFIG.useRestApi) {
      return request('/visitors');
    }
    return Promise.resolve(localStorage.getVisitors());
  },
  
  getById: (id: string) => {
    if (API_CONFIG.useRestApi) {
      return request(`/visitors/${id}`);
    }
    return Promise.resolve(localStorage.getVisitorById(id));
  },
  
  getByCode: (code: string) => {
    if (API_CONFIG.useRestApi) {
      return request(`/visitors/code/${code}`);
    }
    return Promise.resolve(localStorage.getVisitorByCode(code));
  },
  
  create: (visitorData: Parameters<typeof localStorage.createVisitor>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/visitors', 'POST', visitorData);
    }
    return Promise.resolve(localStorage.createVisitor(visitorData));
  },
  
  update: (id: string, updates: Parameters<typeof localStorage.updateVisitor>[1]) => {
    if (API_CONFIG.useRestApi) {
      return request(`/visitors/${id}`, 'PUT', updates);
    }
    return Promise.resolve(localStorage.updateVisitor(id, updates));
  },
};

// ============= PDL-Visitor Link Operations =============
export const links = {
  getAll: () => {
    if (API_CONFIG.useRestApi) {
      return request('/links');
    }
    return Promise.resolve(localStorage.getPDLVisitorLinks());
  },
  
  getForPDL: (pdlId: string) => {
    if (API_CONFIG.useRestApi) {
      return request(`/links/pdl/${pdlId}`);
    }
    return Promise.resolve(localStorage.getLinksForPDL(pdlId));
  },
  
  getForVisitor: (visitorId: string) => {
    if (API_CONFIG.useRestApi) {
      return request(`/links/visitor/${visitorId}`);
    }
    return Promise.resolve(localStorage.getLinksForVisitor(visitorId));
  },
  
  create: (linkData: Parameters<typeof localStorage.createPDLVisitorLink>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/links', 'POST', linkData);
    }
    return Promise.resolve(localStorage.createPDLVisitorLink(linkData));
  },
  
  update: (id: string, updates: Parameters<typeof localStorage.updatePDLVisitorLink>[1]) => {
    if (API_CONFIG.useRestApi) {
      return request(`/links/${id}`, 'PUT', updates);
    }
    return Promise.resolve(localStorage.updatePDLVisitorLink(id, updates));
  },
};

// ============= Visit Session Operations =============
export const sessions = {
  getAll: () => {
    if (API_CONFIG.useRestApi) {
      return request('/sessions');
    }
    return Promise.resolve(localStorage.getVisitSessions());
  },
  
  getToday: () => {
    if (API_CONFIG.useRestApi) {
      return request('/sessions/today');
    }
    return Promise.resolve(localStorage.getTodaySessions());
  },
  
  getActive: () => {
    if (API_CONFIG.useRestApi) {
      return request('/sessions/active');
    }
    return Promise.resolve(localStorage.getActiveSessions());
  },
  
  create: (sessionData: Parameters<typeof localStorage.createVisitSession>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/sessions', 'POST', sessionData);
    }
    return Promise.resolve(localStorage.createVisitSession(sessionData));
  },
  
  update: (id: string, updates: Parameters<typeof localStorage.updateVisitSession>[1]) => {
    if (API_CONFIG.useRestApi) {
      return request(`/sessions/${id}`, 'PUT', updates);
    }
    return Promise.resolve(localStorage.updateVisitSession(id, updates));
  },
};

// ============= Biometric Operations =============
export const biometrics = {
  getAll: () => {
    if (API_CONFIG.useRestApi) {
      return request('/biometrics');
    }
    return Promise.resolve(localStorage.getBiometrics());
  },
  
  getByVisitorId: (visitorId: string) => {
    if (API_CONFIG.useRestApi) {
      return request(`/biometrics/visitor/${visitorId}`);
    }
    return Promise.resolve(localStorage.getBiometricByVisitorId(visitorId));
  },
  
  save: (visitorId: string, embeddings: number[][], qualityScores: number[]) => {
    if (API_CONFIG.useRestApi) {
      return request('/biometrics', 'POST', { visitorId, embeddings, qualityScores });
    }
    return Promise.resolve(localStorage.saveBiometric(visitorId, embeddings, qualityScores));
  },
};

// ============= Dashboard & Analytics =============
export const analytics = {
  getDashboardStats: () => {
    if (API_CONFIG.useRestApi) {
      return request('/analytics/dashboard');
    }
    return Promise.resolve(localStorage.getDashboardStats());
  },
  
  getAnalyticsData: () => {
    if (API_CONFIG.useRestApi) {
      return request('/analytics/data');
    }
    return Promise.resolve(localStorage.getAnalyticsData());
  },
};

// ============= Settings =============
export const settings = {
  get: () => {
    if (API_CONFIG.useRestApi) {
      return request('/settings');
    }
    return Promise.resolve(localStorage.getSettings());
  },
  
  update: (newSettings: Parameters<typeof localStorage.setSettings>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/settings', 'PUT', newSettings);
    }
    localStorage.setSettings(newSettings);
    return Promise.resolve(newSettings);
  },
};

// ============= Audit Logs =============
export const auditLogs = {
  getAll: () => {
    if (API_CONFIG.useRestApi) {
      return request('/audit-logs');
    }
    return Promise.resolve(localStorage.getAuditLogs());
  },
  
  create: (logData: Parameters<typeof localStorage.createAuditLog>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/audit-logs', 'POST', logData);
    }
    return Promise.resolve(localStorage.createAuditLog(logData));
  },
};

// ============= Session Management =============
export const auth = {
  getCurrentUser: () => {
    if (API_CONFIG.useRestApi) {
      return request('/auth/me');
    }
    return Promise.resolve(localStorage.getCurrentUser());
  },
  
  setCurrentUser: (user: Parameters<typeof localStorage.setCurrentUser>[0]) => {
    if (API_CONFIG.useRestApi) {
      return request('/auth/session', 'POST', { user });
    }
    localStorage.setCurrentUser(user);
    return Promise.resolve(user);
  },
  
  logout: () => {
    if (API_CONFIG.useRestApi) {
      return request('/auth/logout', 'POST');
    }
    localStorage.setCurrentUser(null);
    return Promise.resolve(true);
  },
};

// Export config setter for switching to REST API
export function enableRestApi(baseUrl?: string) {
  API_CONFIG.useRestApi = true;
  if (baseUrl) {
    API_CONFIG.baseUrl = baseUrl;
  }
}

export function disableRestApi() {
  API_CONFIG.useRestApi = false;
}
