// ============================================================
// WATCHGUARD TYPE DEFINITIONS
// Production-grade types for full-stack architecture
// ============================================================

// ============================================================
// USER & AUTH
// ============================================================

export type UserRole = 'super_admin' | 'admin' | 'staff' | 'guest';
export type UserStatus = 'pending' | 'active' | 'disabled';

export interface User {
  id: string;
  username: string;
  email?: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  last_login?: string;
}

// ============================================================
// PDL (Person Deprived of Liberty)
// NOTE: No case numbers per privacy requirements
// ============================================================

export type PDLStatus = 'detained' | 'released' | 'transferred' | 'deceased';

// Legacy type for backward compatibility
export interface CrimeEntry {
  offense: string;
  case_number: string;
}

export interface PDL {
  id: string;
  pdl_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: 'male' | 'female';
  gender?: 'male' | 'female'; // Alias for backward compatibility
  date_of_birth?: string;
  date_of_commit?: string; // Keep for existing data
  housing_cell?: string;
  housing_block?: string;
  photo_url?: string; // Keep for existing data (will be removed in production)
  crimes?: CrimeEntry[]; // Legacy - will be removed
  status: PDLStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================
// VISITORS
// ============================================================

export type VisitorStatus = 'active' | 'blacklisted' | 'inactive';

export interface Visitor {
  id: string;
  visitor_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: 'male' | 'female';
  gender?: 'male' | 'female'; // Alias for backward compatibility
  date_of_birth?: string;
  contact_number?: string;
  address?: string;
  valid_id_type?: string;
  valid_id_number?: string;
  photo_url?: string; // Keep for existing data
  qr_code_path?: string;
  id_card_path?: string;
  status: VisitorStatus;
  has_biometrics?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// PDL-VISITOR LINKS (Kin Dalaw)
// ============================================================

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
  // Joined fields (from API)
  pdl?: PDL;
  visitor?: Visitor;
}

// ============================================================
// VISITATION
// ============================================================

export type VisitType = 'regular' | 'conjugal' | 'legal';
export type TimeMethod = 'face_scan' | 'qr_scan' | 'manual_id'; // Legacy
export type VerificationMethod = 'qr' | 'manual' | 'face';
export type VerificationResult = 'pass' | 'fail' | 'skipped';

export interface VisitSession {
  id: string;
  visitor_id: string;
  pdl_id: string;
  pdl_visitor_link_id?: string;
  link_id?: string;
  visit_type: VisitType;
  // Legacy fields (for backward compatibility)
  time_in: string;
  time_in_method: TimeMethod;
  time_out?: string;
  time_out_method?: TimeMethod;
  // New fields
  scheduled_at?: string;
  check_in_at?: string;
  check_out_at?: string;
  check_in_method?: VerificationMethod;
  check_in_result?: VerificationResult;
  check_out_method?: VerificationMethod;
  check_out_result?: VerificationResult;
  notes?: string;
  operator_id?: string;
  created_by?: string;
  created_at: string;
  // Joined fields
  visitor?: Visitor;
  pdl?: PDL;
  operator?: User;
}

// ============================================================
// BIOMETRICS (Legacy - will be removed)
// ============================================================

export interface BiometricData {
  id: string;
  visitor_id: string;
  embeddings: number[][];
  quality_scores: number[];
  created_at: string;
  updated_at: string;
}

// ============================================================
// AUDIT LOGS
// ============================================================

export type AuditAction = 
  | 'user_login' | 'user_logout' | 'user_created'
  | 'user_approved' | 'user_disabled' | 'role_changed'
  | 'pdl_created' | 'pdl_updated'
  | 'visitor_created' | 'visitor_updated' | 'visitor_enrolled'
  | 'biometrics_enrolled' | 'biometrics_verified' | 'biometrics_matched'
  | 'kin_dalaw_created' | 'kin_dalaw_approved' | 'kin_dalaw_rejected'
  | 'link_created' | 'link_approved' | 'link_rejected'
  | 'visit_time_in' | 'visit_time_out'
  | 'visit_check_in' | 'visit_check_out'
  | 'settings_changed';

export interface AuditLog {
  id: string;
  user_id?: string; // Legacy
  actor_user_id?: string;
  action: AuditAction;
  target_type: string;
  subject_type?: string;
  target_id: string;
  subject_id?: string;
  related_activity_id?: string;
  details?: Record<string, unknown>;
  detail_json?: Record<string, unknown>;
  detail_text?: string;
  ip_address?: string;
  created_at: string;
  // Joined fields
  actor?: User;
}

// ============================================================
// SETTINGS
// ============================================================

export interface SystemSettings {
  facility_name: string;
  jail_name?: string;
  jail_region?: string;
  jail_address?: string;
  jail_email?: string;
  jail_contact?: string;
  logo1_path?: string;
  logo2_path?: string;
  logo3_path?: string;
  logo4_path?: string;
  immediate_family_limit: number;
  legal_guardian_limit: number;
  close_friend_limit: number;
  face_recognition_threshold: number;
  face_recognition_margin?: number;
  allow_guest_enrollment: boolean;
  data_retention_days: number;
  conjugal_relationships: RelationshipType[];
}

// ============================================================
// LABELS & CONSTANTS
// ============================================================

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

export const PDL_STATUS_LABELS: Record<PDLStatus, string> = {
  detained: 'Detained',
  released: 'Released',
  transferred: 'Transferred',
  deceased: 'Deceased',
};

export const VISITOR_STATUS_LABELS: Record<VisitorStatus, string> = {
  active: 'Active',
  blacklisted: 'Blacklisted',
  inactive: 'Inactive',
};

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  regular: 'Regular Visit',
  conjugal: 'Conjugal Visit',
  legal: 'Legal Visit',
};

export const VERIFICATION_METHOD_LABELS: Record<VerificationMethod, string> = {
  qr: 'QR Code',
  manual: 'Manual Entry',
  face: 'Face Recognition',
};

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardStats {
  total_pdl: number;
  total_visitors: number;
  todays_visits: number;
  active_sessions: number;
  pending_approvals: number;
  visits_this_week: number;
  visits_this_month: number;
}

export interface ConnectionStatus {
  api: boolean;
  biometrics: boolean;
  database: boolean;
  last_check: string;
}

// Re-export CrimeEntry (defined above with PDL)
