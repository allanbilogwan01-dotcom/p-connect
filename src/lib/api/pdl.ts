/**
 * PDL (Person Deprived of Liberty) API
 * 
 * NOTE: PDL records do NOT include:
 * - Face photos/biometrics (privacy requirement)
 * - Case numbers (removed per specification)
 */

import { api } from './client';

export type PDLStatus = 'detained' | 'released' | 'transferred' | 'deceased';

export interface PDL {
  id: string;
  pdl_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: 'male' | 'female';
  date_of_birth?: string;
  housing_cell?: string;
  housing_block?: string;
  status: PDLStatus;
  created_at: string;
  updated_at: string;
}

export interface CreatePDLRequest {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: 'male' | 'female';
  date_of_birth?: string;
  housing_cell?: string;
  housing_block?: string;
  status?: PDLStatus;
}

export interface UpdatePDLRequest extends Partial<CreatePDLRequest> {
  status?: PDLStatus;
}

export interface PDLListResponse {
  items: PDL[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get all PDLs with optional search
 */
export async function getPDLs(params?: { search?: string; status?: PDLStatus; page?: number; limit?: number }) {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  
  const query = queryParams.toString();
  return api.get<PDLListResponse>(`/pdl${query ? `?${query}` : ''}`);
}

/**
 * Get PDL by ID
 */
export async function getPDLById(id: string) {
  return api.get<PDL>(`/pdl/${id}`);
}

/**
 * Get PDL by code
 */
export async function getPDLByCode(code: string) {
  return api.get<PDL>(`/pdl/code/${code}`);
}

/**
 * Create new PDL
 */
export async function createPDL(data: CreatePDLRequest) {
  return api.post<PDL>('/pdl', data);
}

/**
 * Update PDL
 */
export async function updatePDL(id: string, data: UpdatePDLRequest) {
  return api.put<PDL>(`/pdl/${id}`, data);
}

/**
 * Get PDL statistics
 */
export async function getPDLStats() {
  return api.get<{
    total: number;
    detained: number;
    released: number;
    transferred: number;
    deceased: number;
  }>('/pdl/stats');
}
