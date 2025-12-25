import type { 
  User, PDL, Visitor, PDLVisitorLink, VisitSession, 
  AuditLog, SystemSettings, AuditAction, BiometricData 
} from '@/types';

const STORAGE_KEYS = {
  USERS: 'jailvisit_users',
  PDLS: 'jailvisit_pdls',
  VISITORS: 'jailvisit_visitors',
  PDL_VISITORS: 'jailvisit_pdl_visitors',
  VISIT_SESSIONS: 'jailvisit_visit_sessions',
  AUDIT_LOGS: 'jailvisit_audit_logs',
  SETTINGS: 'jailvisit_settings',
  CURRENT_USER: 'jailvisit_user',
  PASSWORDS: 'jailvisit_passwords',
  BIOMETRICS: 'jailvisit_biometrics',
};

const DEFAULT_SETTINGS: SystemSettings = {
  facility_name: 'City Jail Facility',
  immediate_family_limit: -1,
  legal_guardian_limit: 2,
  close_friend_limit: 3,
  face_recognition_threshold: 0.7,
  face_recognition_margin: 0.1,
  allow_guest_enrollment: true,
  data_retention_days: 365,
  conjugal_relationships: ['wife', 'husband', 'spouse', 'live_in_partner', 'common_law_partner'],
};

const DEFAULT_SUPER_ADMIN: User = {
  id: 'super_admin_001',
  username: 'JO1 Guiral',
  email: 'superadmin@jailvisit.local',
  full_name: 'JO1 Guiral MPT',
  role: 'super_admin',
  status: 'active',
  created_at: new Date().toISOString(),
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Initialize storage with defaults
export function initializeStorage(): void {
  const users = getItem<User[]>(STORAGE_KEYS.USERS, []);
  if (users.length === 0) {
    setItem(STORAGE_KEYS.USERS, [DEFAULT_SUPER_ADMIN]);
    const passwords = getItem<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
    passwords['JO1 Guiral'] = 'Freediver26m';
    setItem(STORAGE_KEYS.PASSWORDS, passwords);
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    setItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
}

// User Operations
export function getUsers(): User[] {
  return getItem<User[]>(STORAGE_KEYS.USERS, []);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function getUserByUsername(username: string): User | undefined {
  return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function createUser(user: Omit<User, 'id' | 'created_at'>): User {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  users.push(newUser);
  setItem(STORAGE_KEYS.USERS, users);
  return newUser;
}

export function updateUser(id: string, updates: Partial<User>): User | undefined {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return undefined;
  users[index] = { ...users[index], ...updates };
  setItem(STORAGE_KEYS.USERS, users);
  return users[index];
}

export function verifyPassword(username: string, password: string): boolean {
  const passwords = getItem<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
  return passwords[username] === password;
}

export function setPassword(username: string, password: string): void {
  const passwords = getItem<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
  passwords[username] = password;
  setItem(STORAGE_KEYS.PASSWORDS, passwords);
}

// PDL Operations
export function getPDLs(): PDL[] {
  return getItem<PDL[]>(STORAGE_KEYS.PDLS, []);
}

export function getPDLById(id: string): PDL | undefined {
  return getPDLs().find(p => p.id === id);
}

export function createPDL(pdl: Omit<PDL, 'id' | 'created_at' | 'updated_at' | 'pdl_code'>): PDL {
  const pdls = getPDLs();
  const year = new Date().getFullYear();
  const sequence = pdls.filter(p => p.pdl_code.startsWith(`PDL-${year}`)).length + 1;
  const pdl_code = `PDL-${year}-${String(sequence).padStart(3, '0')}`;
  
  const newPDL: PDL = {
    ...pdl,
    id: generateId(),
    pdl_code,
    // Transform text fields to uppercase
    first_name: pdl.first_name.toUpperCase(),
    middle_name: pdl.middle_name?.toUpperCase(),
    last_name: pdl.last_name.toUpperCase(),
    suffix: pdl.suffix?.toUpperCase(),
    crimes: pdl.crimes.map(c => ({
      offense: c.offense.toUpperCase(),
      case_number: c.case_number.toUpperCase(),
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  pdls.push(newPDL);
  setItem(STORAGE_KEYS.PDLS, pdls);
  return newPDL;
}

export function updatePDL(id: string, updates: Partial<PDL>): PDL | undefined {
  const pdls = getPDLs();
  const index = pdls.findIndex(p => p.id === id);
  if (index === -1) return undefined;
  pdls[index] = { ...pdls[index], ...updates, updated_at: new Date().toISOString() };
  setItem(STORAGE_KEYS.PDLS, pdls);
  return pdls[index];
}

// Visitor Operations
export function getVisitors(): Visitor[] {
  return getItem<Visitor[]>(STORAGE_KEYS.VISITORS, []);
}

export function getVisitorById(id: string): Visitor | undefined {
  return getVisitors().find(v => v.id === id);
}

export function getVisitorByCode(code: string): Visitor | undefined {
  return getVisitors().find(v => v.visitor_code === code);
}

export function generateVisitorCode(): string {
  const visitors = getVisitors();
  let code: string;
  do {
    code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  } while (visitors.some(v => v.visitor_code === code));
  return code;
}

export function createVisitor(visitor: Omit<Visitor, 'id' | 'created_at' | 'updated_at' | 'visitor_code'>): Visitor {
  const visitors = getVisitors();
  const newVisitor: Visitor = {
    ...visitor,
    id: generateId(),
    visitor_code: generateVisitorCode(),
    // Transform text fields to uppercase
    first_name: visitor.first_name.toUpperCase(),
    middle_name: visitor.middle_name?.toUpperCase(),
    last_name: visitor.last_name.toUpperCase(),
    suffix: visitor.suffix?.toUpperCase(),
    address: visitor.address.toUpperCase(),
    valid_id_type: visitor.valid_id_type?.toUpperCase(),
    valid_id_number: visitor.valid_id_number?.toUpperCase(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  visitors.push(newVisitor);
  setItem(STORAGE_KEYS.VISITORS, visitors);
  return newVisitor;
}

export function updateVisitor(id: string, updates: Partial<Visitor>): Visitor | undefined {
  const visitors = getVisitors();
  const index = visitors.findIndex(v => v.id === id);
  if (index === -1) return undefined;
  visitors[index] = { ...visitors[index], ...updates, updated_at: new Date().toISOString() };
  setItem(STORAGE_KEYS.VISITORS, visitors);
  return visitors[index];
}

// PDL-Visitor Link Operations
export function getPDLVisitorLinks(): PDLVisitorLink[] {
  return getItem<PDLVisitorLink[]>(STORAGE_KEYS.PDL_VISITORS, []);
}

export function createPDLVisitorLink(link: Omit<PDLVisitorLink, 'id' | 'created_at' | 'updated_at'>): PDLVisitorLink {
  const links = getPDLVisitorLinks();
  const newLink: PDLVisitorLink = {
    ...link,
    id: generateId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  links.push(newLink);
  setItem(STORAGE_KEYS.PDL_VISITORS, links);
  return newLink;
}

export function updatePDLVisitorLink(id: string, updates: Partial<PDLVisitorLink>): PDLVisitorLink | undefined {
  const links = getPDLVisitorLinks();
  const index = links.findIndex(l => l.id === id);
  if (index === -1) return undefined;
  links[index] = { ...links[index], ...updates, updated_at: new Date().toISOString() };
  setItem(STORAGE_KEYS.PDL_VISITORS, links);
  return links[index];
}

export function getLinksForPDL(pdlId: string): PDLVisitorLink[] {
  return getPDLVisitorLinks().filter(l => l.pdl_id === pdlId);
}

export function getLinksForVisitor(visitorId: string): PDLVisitorLink[] {
  return getPDLVisitorLinks().filter(l => l.visitor_id === visitorId);
}

// Visit Session Operations
export function getVisitSessions(): VisitSession[] {
  return getItem<VisitSession[]>(STORAGE_KEYS.VISIT_SESSIONS, []);
}

export function createVisitSession(session: Omit<VisitSession, 'id' | 'created_at'>): VisitSession {
  const sessions = getVisitSessions();
  const newSession: VisitSession = {
    ...session,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  sessions.push(newSession);
  setItem(STORAGE_KEYS.VISIT_SESSIONS, sessions);
  return newSession;
}

export function updateVisitSession(id: string, updates: Partial<VisitSession>): VisitSession | undefined {
  const sessions = getVisitSessions();
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return undefined;
  sessions[index] = { ...sessions[index], ...updates };
  setItem(STORAGE_KEYS.VISIT_SESSIONS, sessions);
  return sessions[index];
}

export function getOpenSession(visitorId: string): VisitSession | undefined {
  const today = new Date().toISOString().split('T')[0];
  return getVisitSessions().find(s => 
    s.visitor_id === visitorId && 
    !s.time_out && 
    s.time_in.startsWith(today)
  );
}

export function getTodaySessions(): VisitSession[] {
  const today = new Date().toISOString().split('T')[0];
  return getVisitSessions().filter(s => s.time_in.startsWith(today));
}

export function getActiveSessions(): VisitSession[] {
  const today = new Date().toISOString().split('T')[0];
  return getVisitSessions().filter(s => 
    s.time_in.startsWith(today) && !s.time_out
  );
}

export function getCompletedTodaySessions(): VisitSession[] {
  const today = new Date().toISOString().split('T')[0];
  return getVisitSessions().filter(s => 
    s.time_in.startsWith(today) && s.time_out
  );
}

// Biometric Operations
export function getBiometrics(): BiometricData[] {
  return getItem<BiometricData[]>(STORAGE_KEYS.BIOMETRICS, []);
}

export function getBiometricByVisitorId(visitorId: string): BiometricData | undefined {
  return getBiometrics().find(b => b.visitor_id === visitorId);
}

export function saveBiometric(visitorId: string, embeddings: number[][], qualityScores: number[]): BiometricData {
  const biometrics = getBiometrics();
  const existing = biometrics.findIndex(b => b.visitor_id === visitorId);
  
  const biometric: BiometricData = {
    id: existing >= 0 ? biometrics[existing].id : generateId(),
    visitor_id: visitorId,
    embeddings,
    quality_scores: qualityScores,
    created_at: existing >= 0 ? biometrics[existing].created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  if (existing >= 0) {
    biometrics[existing] = biometric;
  } else {
    biometrics.push(biometric);
  }
  
  setItem(STORAGE_KEYS.BIOMETRICS, biometrics);
  return biometric;
}

// Dashboard & Analytics
export function getDashboardStats() {
  const pdls = getPDLs();
  const visitors = getVisitors();
  const links = getPDLVisitorLinks();
  const todaySessions = getTodaySessions();
  const sessions = getVisitSessions();
  
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return {
    total_pdl: pdls.filter(p => p.status === 'detained').length,
    total_visitors: visitors.filter(v => v.status === 'active').length,
    todays_visits: todaySessions.length,
    pending_approvals: links.filter(l => l.approval_status === 'pending').length,
    active_sessions: getActiveSessions().length,
    visits_this_week: sessions.filter(s => new Date(s.time_in) >= weekAgo).length,
    visits_this_month: sessions.filter(s => new Date(s.time_in) >= monthAgo).length,
  };
}

export function getAnalyticsData() {
  const sessions = getVisitSessions();
  const pdls = getPDLs();
  const visitors = getVisitors();
  
  // Weekly data
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData = days.map(day => ({
    day,
    regular: 0,
    conjugal: 0,
  }));
  
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  sessions.filter(s => new Date(s.time_in) >= weekAgo).forEach(s => {
    const dayIndex = new Date(s.time_in).getDay();
    if (s.visit_type === 'regular') {
      weeklyData[dayIndex].regular++;
    } else {
      weeklyData[dayIndex].conjugal++;
    }
  });
  
  // Peak hours
  const hourCounts: Record<number, number> = {};
  sessions.forEach(s => {
    const hour = new Date(s.time_in).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  const peakHours = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      hour: `${hour}:00`,
      visits: count,
    }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8);
  
  // Top PDLs
  const pdlCounts: Record<string, number> = {};
  sessions.forEach(s => {
    pdlCounts[s.pdl_id] = (pdlCounts[s.pdl_id] || 0) + 1;
  });
  
  const topPDLs = Object.entries(pdlCounts)
    .map(([id, count]) => {
      const pdl = pdls.find(p => p.id === id);
      return {
        name: pdl ? `${pdl.last_name}, ${pdl.first_name}` : 'Unknown',
        visits: count,
      };
    })
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);
  
  // Top Visitors
  const visitorCounts: Record<string, number> = {};
  sessions.forEach(s => {
    visitorCounts[s.visitor_id] = (visitorCounts[s.visitor_id] || 0) + 1;
  });
  
  const topVisitors = Object.entries(visitorCounts)
    .map(([id, count]) => {
      const visitor = visitors.find(v => v.id === id);
      return {
        name: visitor ? `${visitor.last_name}, ${visitor.first_name}` : 'Unknown',
        visits: count,
      };
    })
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);
  
  return { weeklyData, peakHours, topPDLs, topVisitors };
}

// Audit Logs
export function createAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): AuditLog {
  const logs = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  const newLog: AuditLog = {
    ...log,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  logs.push(newLog);
  setItem(STORAGE_KEYS.AUDIT_LOGS, logs);
  return newLog;
}

export function getAuditLogs(): AuditLog[] {
  return getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
}

// Settings
export function getSettings(): SystemSettings {
  return getItem<SystemSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function setSettings(settings: SystemSettings): void {
  setItem(STORAGE_KEYS.SETTINGS, settings);
}

// Session Management
export function getCurrentUser(): User | null {
  return getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
}

export function setCurrentUser(user: User | null): void {
  setItem(STORAGE_KEYS.CURRENT_USER, user);
}

export function resetStorage(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  initializeStorage();
}
