/**
 * Settings API
 * 
 * Jail/facility settings stored in PostgreSQL as SSOT.
 */

import { api } from './client';

export interface JailSettings {
  jail_name: string;
  jail_region: string;
  jail_address: string;
  jail_email: string;
  jail_contact: string;
  logo1_path?: string;
  logo2_path?: string;
  logo3_path?: string;
  logo4_path?: string;
}

export interface SystemSettings {
  immediate_family_limit: number;
  legal_guardian_limit: number;
  close_friend_limit: number;
  face_recognition_threshold: number;
  allow_guest_enrollment: boolean;
  data_retention_days: number;
  conjugal_relationships: string[];
}

export interface AllSettings extends JailSettings, SystemSettings {}

/**
 * Get jail/facility settings
 */
export async function getJailSettings() {
  return api.get<JailSettings>('/settings/jail');
}

/**
 * Update jail/facility settings
 */
export async function updateJailSettings(settings: Partial<JailSettings>) {
  return api.post<JailSettings>('/settings/jail', settings);
}

/**
 * Upload logo
 * @param slot - Logo slot (1-4)
 * @param file - Image file
 */
export async function uploadLogo(slot: 1 | 2 | 3 | 4, file: File) {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await fetch(`/api/settings/jail/logo/${slot}`, {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('watchguard_auth_token') || ''}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    return { data: null, error: { code: 'UPLOAD_ERROR', message: error.message, status: response.status }, ok: false };
  }

  const data = await response.json();
  return { data, error: null, ok: true };
}

/**
 * Get system settings
 */
export async function getSystemSettings() {
  return api.get<SystemSettings>('/settings/system');
}

/**
 * Update system settings
 */
export async function updateSystemSettings(settings: Partial<SystemSettings>) {
  return api.post<SystemSettings>('/settings/system', settings);
}

/**
 * Get all settings (combined)
 */
export async function getAllSettings() {
  return api.get<AllSettings>('/settings');
}
