/**
 * Visitation API
 * 
 * Handles visit check-in/check-out and session management.
 */

import { api } from './client';

export type VisitType = 'regular' | 'conjugal' | 'legal';
export type VerificationMethod = 'qr' | 'manual' | 'face';
export type VerificationResult = 'pass' | 'fail' | 'skipped';

export interface VisitSession {
  id: string;
  visitor_id: string;
  pdl_id: string;
  visit_type: VisitType;
  scheduled_at?: string;
  check_in_at?: string;
  check_out_at?: string;
  verification_method: VerificationMethod;
  verification_result: VerificationResult;
  notes?: string;
  created_by: string;
  created_at: string;
  // Joined fields
  visitor?: {
    id: string;
    visitor_code: string;
    first_name: string;
    last_name: string;
  };
  pdl?: {
    id: string;
    pdl_code: string;
    first_name: string;
    last_name: string;
  };
  operator?: {
    id: string;
    full_name: string;
  };
}

export interface CheckInRequest {
  visitor_id: string;
  pdl_id: string;
  visit_type: VisitType;
  verification_method: VerificationMethod;
  verification_result?: VerificationResult;
  notes?: string;
}

export interface CheckOutRequest {
  session_id: string;
  verification_method?: VerificationMethod;
  notes?: string;
}

export interface VisitListResponse {
  items: VisitSession[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get visits with filters
 */
export async function getVisits(params?: {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  pdlId?: string;
  visitorId?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.dateFrom) queryParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) queryParams.set('dateTo', params.dateTo);
  if (params?.search) queryParams.set('search', params.search);
  if (params?.pdlId) queryParams.set('pdlId', params.pdlId);
  if (params?.visitorId) queryParams.set('visitorId', params.visitorId);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  
  const query = queryParams.toString();
  return api.get<VisitListResponse>(`/visits${query ? `?${query}` : ''}`);
}

/**
 * Get today's visits
 */
export async function getTodayVisits() {
  return api.get<VisitSession[]>('/visits/today');
}

/**
 * Get active visits (checked in but not out)
 */
export async function getActiveVisits() {
  return api.get<VisitSession[]>('/visits/active');
}

/**
 * Check-in visitor
 */
export async function checkIn(data: CheckInRequest) {
  return api.post<VisitSession>('/visits/check-in', data);
}

/**
 * Check-out visitor
 */
export async function checkOut(data: CheckOutRequest) {
  return api.post<VisitSession>('/visits/check-out', data);
}

/**
 * Get visit by ID
 */
export async function getVisitById(id: string) {
  return api.get<VisitSession>(`/visits/${id}`);
}

/**
 * Get open session for visitor (if any)
 */
export async function getOpenSession(visitorId: string) {
  return api.get<VisitSession | null>(`/visits/open/${visitorId}`);
}

/**
 * Get visit statistics
 */
export async function getVisitStats(params?: { dateFrom?: string; dateTo?: string }) {
  const queryParams = new URLSearchParams();
  if (params?.dateFrom) queryParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) queryParams.set('dateTo', params.dateTo);
  
  const query = queryParams.toString();
  return api.get<{
    total: number;
    today: number;
    active: number;
    by_type: Record<VisitType, number>;
    by_method: Record<VerificationMethod, number>;
  }>(`/visits/stats${query ? `?${query}` : ''}`);
}
