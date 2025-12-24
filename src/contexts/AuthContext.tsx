import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { 
  getCurrentUser, 
  setCurrentUser, 
  getUserByUsername, 
  verifyPassword,
  updateUser,
  createAuditLog,
  initializeStorage
} from '@/lib/localStorage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    'manage_users', 'approve_users', 'manage_roles', 'manage_settings',
    'view_analytics', 'view_audit_logs', 'manage_pdl', 'manage_visitors',
    'approve_kin_dalaw', 'create_kin_dalaw', 'operate_visitation',
    'view_reports', 'export_data', 'enroll_visitors'
  ],
  admin: [
    'view_analytics', 'manage_pdl', 'manage_visitors',
    'approve_kin_dalaw', 'create_kin_dalaw', 'operate_visitation',
    'view_reports', 'export_data', 'enroll_visitors'
  ],
  staff: [
    'manage_pdl', 'manage_visitors', 'create_kin_dalaw',
    'operate_visitation', 'view_reports', 'enroll_visitors'
  ],
  guest: [
    'operate_visitation', 'view_reports', 'enroll_visitors'
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeStorage();
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const foundUser = getUserByUsername(username);
    
    if (!foundUser) {
      return { success: false, error: 'User not found' };
    }
    
    if (!verifyPassword(username, password)) {
      return { success: false, error: 'Invalid password' };
    }
    
    if (foundUser.status === 'pending') {
      return { success: false, error: 'Account pending approval' };
    }
    
    if (foundUser.status === 'disabled') {
      return { success: false, error: 'Account has been disabled' };
    }

    // Update last login
    const updatedUser = updateUser(foundUser.id, { 
      last_login: new Date().toISOString() 
    });
    
    if (updatedUser) {
      setUser(updatedUser);
      setCurrentUser(updatedUser);
      
      createAuditLog({
        user_id: updatedUser.id,
        action: 'user_login',
        target_type: 'user',
        target_id: updatedUser.id,
      });
      
      return { success: true };
    }
    
    return { success: false, error: 'Login failed' };
  };

  const logout = () => {
    if (user) {
      createAuditLog({
        user_id: user.id,
        action: 'user_logout',
        target_type: 'user',
        target_id: user.id,
      });
    }
    setUser(null);
    setCurrentUser(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      hasPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
