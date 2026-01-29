/**
 * Audit Log API
 * 
 * Server-authoritative audit logging with enriched details.
 * Audit logs include WHO, WHAT, WHEN, WHERE, HOW, WHY.
 */

import { api } from './client';

export type AuditActionType =
  | 'user_login'
  | 'user_logout'
  | 'user_created'
  | 'user_approved'
  | 'user_disabled'
  | 'role_changed'
  | 'pdl_created'
  | 'pdl_updated'
  | 'visitor_created'
  | 'visitor_updated'
  | 'visitor_enrolled'
  | 'biometrics_enrolled'
  | 'biometrics_verified'
  | 'biometrics_matched'
  | 'link_created'
  | 'link_approved'
  | 'link_rejected'
  | 'visit_check_in'
  | 'visit_check_out'
  | 'settings_changed';

export interface AuditLog {
  id: string;
  actor_user_id: string;
  action_type: AuditActionType;
  subject_type: string;
  subject_id: string;
  related_activity_id?: string;
  detail_json: Record<string, unknown>;
  detail_text: string; // Human-readable summary answering WH questions
  created_at: string;
  // Joined fields
  actor?: {
    id: string;
    full_name: string;
    username: string;
  };
}

export interface AuditListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(params?: {
  actionType?: AuditActionType;
  subjectType?: string;
  subjectId?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.actionType) queryParams.set('actionType', params.actionType);
  if (params?.subjectType) queryParams.set('subjectType', params.subjectType);
  if (params?.subjectId) queryParams.set('subjectId', params.subjectId);
  if (params?.actorId) queryParams.set('actorId', params.actorId);
  if (params?.dateFrom) queryParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) queryParams.set('dateTo', params.dateTo);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  
  const query = queryParams.toString();
  return api.get<AuditListResponse>(`/audit${query ? `?${query}` : ''}`);
}

/**
 * Get audit log by ID
 */
export async function getAuditLogById(id: string) {
  return api.get<AuditLog>(`/audit/${id}`);
}

/**
 * Get audit logs for a specific subject
 */
export async function getAuditLogsForSubject(subjectType: string, subjectId: string) {
  return api.get<AuditLog[]>(`/audit/subject/${subjectType}/${subjectId}`);
}

/**
 * Get recent audit activity (dashboard)
 */
export async function getRecentActivity(limit: number = 10) {
  return api.get<AuditLog[]>(`/audit/recent?limit=${limit}`);
}
