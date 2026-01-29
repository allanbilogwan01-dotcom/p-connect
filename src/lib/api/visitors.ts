/**
 * Visitors API
 * 
 * Handles visitor CRUD and PDL-Visitor relationships (Kin Dalaw).
 */

import { api } from './client';

export type VisitorStatus = 'active' | 'blacklisted' | 'inactive';
export type RelationshipType = 
  | 'spouse' | 'wife' | 'husband'
  | 'live_in_partner' | 'common_law_partner'
  | 'parent' | 'child' | 'sibling'
  | 'grandparent' | 'grandchild'
  | 'aunt_uncle' | 'cousin' | 'niece_nephew'
  | 'legal_guardian' | 'close_friend' | 'other';

export type VisitorCategory = 'immediate_family' | 'legal_guardian' | 'close_friend';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Visitor {
  id: string;
  visitor_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: 'male' | 'female';
  date_of_birth?: string;
  contact_number?: string;
  address?: string;
  status: VisitorStatus;
  has_biometrics: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVisitorRequest {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: 'male' | 'female';
  date_of_birth?: string;
  contact_number?: string;
  address?: string;
}

export interface PDLVisitorLink {
  id: string;
  pdl_id: string;
  visitor_id: string;
  relationship: RelationshipType;
  category: VisitorCategory;
  approval_status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  pdl?: {
    id: string;
    pdl_code: string;
    first_name: string;
    last_name: string;
  };
  visitor?: {
    id: string;
    visitor_code: string;
    first_name: string;
    last_name: string;
  };
}

export interface CreateLinkRequest {
  pdl_id: string;
  visitor_id: string;
  relationship: RelationshipType;
  category: VisitorCategory;
}

export interface VisitorListResponse {
  items: Visitor[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get all visitors with optional search
 */
export async function getVisitors(params?: { search?: string; status?: VisitorStatus; page?: number; limit?: number }) {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  
  const query = queryParams.toString();
  return api.get<VisitorListResponse>(`/visitors${query ? `?${query}` : ''}`);
}

/**
 * Get visitor by ID
 */
export async function getVisitorById(id: string) {
  return api.get<Visitor>(`/visitors/${id}`);
}

/**
 * Get visitor by code
 */
export async function getVisitorByCode(code: string) {
  return api.get<Visitor>(`/visitors/code/${code}`);
}

/**
 * Create new visitor
 */
export async function createVisitor(data: CreateVisitorRequest) {
  return api.post<Visitor>('/visitors', data);
}

/**
 * Update visitor
 */
export async function updateVisitor(id: string, data: Partial<CreateVisitorRequest>) {
  return api.put<Visitor>(`/visitors/${id}`, data);
}

/**
 * Get PDL-Visitor links for a PDL
 */
export async function getLinksForPDL(pdlId: string) {
  return api.get<PDLVisitorLink[]>(`/links/pdl/${pdlId}`);
}

/**
 * Get PDL-Visitor links for a visitor
 */
export async function getLinksForVisitor(visitorId: string) {
  return api.get<PDLVisitorLink[]>(`/links/visitor/${visitorId}`);
}

/**
 * Create PDL-Visitor link (Kin Dalaw)
 */
export async function createLink(data: CreateLinkRequest) {
  return api.post<PDLVisitorLink>('/links', data);
}

/**
 * Approve PDL-Visitor link
 */
export async function approveLink(linkId: string) {
  return api.post<PDLVisitorLink>(`/links/${linkId}/approve`);
}

/**
 * Reject PDL-Visitor link
 */
export async function rejectLink(linkId: string, reason: string) {
  return api.post<PDLVisitorLink>(`/links/${linkId}/reject`, { reason });
}

/**
 * Get pending links (for approval)
 */
export async function getPendingLinks() {
  return api.get<PDLVisitorLink[]>('/links/pending');
}

/**
 * Check visitor enrollment status
 */
export async function checkEnrollmentStatus(visitorId: string) {
  return api.get<{ enrolled: boolean; samples_count: number }>(`/visitors/${visitorId}/enrollment-status`);
}
