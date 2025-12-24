export type UserRole = 'super_admin' | 'admin' | 'staff' | 'guest';
export type UserStatus = 'pending' | 'active' | 'disabled';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  last_login?: string;
}

export interface PDL {
  id: string;
  pdl_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  cell_block: string;
  cell_number: string;
  date_of_commit: string;
  photo_url?: string;
  crime?: string;
  status: 'detained' | 'released' | 'transferred';
  created_at: string;
  updated_at: string;
}

export interface Visitor {
  id: string;
  visitor_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  contact_number: string;
  address: string;
  valid_id_type?: string;
  valid_id_number?: string;
  photo_url?: string;
  qr_code_path?: string;
  id_card_path?: string;
  status: 'active' | 'blacklisted' | 'inactive';
  created_at: string;
  updated_at: string;
}

export type RelationshipType = 
  | 'spouse' | 'wife' | 'husband'
  | 'live_in_partner' | 'common_law_partner'
  | 'parent' | 'child' | 'sibling'
  | 'grandparent' | 'grandchild'
  | 'aunt_uncle' | 'cousin' | 'niece_nephew'
  | 'legal_guardian' | 'close_friend' | 'other';

export type VisitorCategory = 'immediate_family' | 'legal_guardian' | 'close_friend';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

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
}

export type VisitType = 'regular' | 'conjugal';
export type TimeMethod = 'face_scan' | 'qr_scan' | 'manual_id';

export interface VisitSession {
  id: string;
  visitor_id: string;
  pdl_id: string;
  pdl_visitor_link_id: string;
  visit_type: VisitType;
  time_in: string;
  time_in_method: TimeMethod;
  time_out?: string;
  time_out_method?: TimeMethod;
  operator_id: string;
  notes?: string;
  created_at: string;
}

export interface BiometricData {
  id: string;
  visitor_id: string;
  embeddings: number[][];
  quality_scores: number[];
  created_at: string;
  updated_at: string;
}

export type AuditAction = 
  | 'user_login' | 'user_logout' | 'user_created'
  | 'user_approved' | 'user_disabled' | 'role_changed'
  | 'pdl_created' | 'pdl_updated'
  | 'visitor_created' | 'visitor_updated' | 'visitor_enrolled'
  | 'kin_dalaw_created' | 'kin_dalaw_approved' | 'kin_dalaw_rejected'
  | 'visit_time_in' | 'visit_time_out'
  | 'settings_changed';

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  target_type: string;
  target_id: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface SystemSettings {
  facility_name: string;
  immediate_family_limit: number;
  legal_guardian_limit: number;
  close_friend_limit: number;
  face_recognition_threshold: number;
  face_recognition_margin: number;
  allow_guest_enrollment: boolean;
  data_retention_days: number;
  conjugal_relationships: RelationshipType[];
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  spouse: 'Spouse',
  wife: 'Wife',
  husband: 'Husband',
  live_in_partner: 'Live-in Partner',
  common_law_partner: 'Common Law Partner',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  grandparent: 'Grandparent',
  grandchild: 'Grandchild',
  aunt_uncle: 'Aunt/Uncle',
  cousin: 'Cousin',
  niece_nephew: 'Niece/Nephew',
  legal_guardian: 'Legal Guardian',
  close_friend: 'Close Friend',
  other: 'Other',
};

export const CATEGORY_LABELS: Record<VisitorCategory, string> = {
  immediate_family: 'Immediate Family',
  legal_guardian: 'Legal Guardian',
  close_friend: 'Close Friend',
};

export const CONJUGAL_RELATIONSHIPS: RelationshipType[] = [
  'wife', 'husband', 'spouse', 'live_in_partner', 'common_law_partner'
];
