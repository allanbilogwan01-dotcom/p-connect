/**
 * Authentication API
 */

import { api, setAuthToken } from './client';
import type { User, UserRole } from '@/types';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  full_name: string;
  role?: UserRole;
}

export interface SetupCheckResponse {
  setup_needed: boolean;
  reason?: string;
}

/**
 * Check if initial setup is needed
 */
export async function checkSetupNeeded() {
  return api.get<SetupCheckResponse>('/auth/setup-needed', { skipAuth: true });
}

/**
 * Login user
 */
export async function login(credentials: LoginRequest) {
  const result = await api.post<LoginResponse>('/auth/login', credentials, { skipAuth: true });
  
  if (result.ok && result.data?.token) {
    setAuthToken(result.data.token);
  }
  
  return result;
}

/**
 * Logout current user
 */
export async function logout() {
  const result = await api.post('/auth/logout');
  setAuthToken(null);
  return result;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  return api.get<User>('/auth/me');
}

/**
 * Register new user (admin only after setup)
 */
export async function registerUser(data: RegisterRequest) {
  return api.post<User>('/auth/register', data);
}

/**
 * Change password
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  return api.post('/auth/change-password', { currentPassword, newPassword });
}

/**
 * Initial setup - create first admin user
 */
export async function initialSetup(data: RegisterRequest & { facilityName: string }) {
  const result = await api.post<LoginResponse>('/auth/setup', data, { skipAuth: true });
  
  if (result.ok && result.data?.token) {
    setAuthToken(result.data.token);
  }
  
  return result;
}
