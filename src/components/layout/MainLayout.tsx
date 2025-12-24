import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, UserPlus, Link2, Clock, 
  FileText, BarChart3, Settings, LogOut, Menu, X,
  Shield, ChevronDown, Bell
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { getSettings } from '@/lib/localStorage';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  permission?: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'PDL Masterlist', path: '/pdl', permission: 'manage_pdl' },
  { icon: UserPlus, label: 'Visitor Enrollment', path: '/visitors', permission: 'manage_visitors' },
  { icon: Link2, label: 'Kin Dalaw', path: '/kin-dalaw', permission: 'create_kin_dalaw' },
  { icon: Clock, label: 'Visitation', path: '/visitation', permission: 'operate_visitation' },
  { icon: FileText, label: 'Reports', path: '/reports', permission: 'view_reports' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', permission: 'view_analytics' },
  { icon: Shield, label: 'User Management', path: '/users', permission: 'manage_users' },
  { icon: Settings, label: 'Settings', path: '/settings', permission: 'manage_settings' },
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout, hasPermission, hasRole } = useAuth();
  const navigate = useNavigate();
  const settings = getSettings();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.roles && !hasRole(item.roles as any)) return false;
    return true;
  });

  const roleColors: Record<string, string> = {
    super_admin: 'text-primary',
    admin: 'text-info',
    staff: 'text-success',
    guest: 'text-muted-foreground',
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        className="hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border fixed h-screen z-40"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="font-bold text-foreground gold-text">WatchGuard</h1>
                  <p className="text-xs text-muted-foreground">Jail Visitation System</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'nav-link',
                  isActive && 'active',
                  !sidebarOpen && 'justify-center px-0'
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence mode="wait">
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-semibold">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="font-medium text-foreground truncate">{user?.full_name}</p>
                  <p className={cn('text-xs capitalize', roleColors[user?.role || 'guest'])}>
                    {user?.role?.replace('_', ' ')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              'w-full mt-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10',
              !sidebarOpen && 'px-0'
            )}
          >
            <LogOut className="w-5 h-5" />
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="ml-2"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </motion.aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <span className="font-bold gold-text">WatchGuard</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            className="lg:hidden fixed inset-0 top-16 bg-sidebar z-40 overflow-y-auto"
          >
            <nav className="p-4 space-y-1">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn('nav-link', isActive && 'active')
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{user?.full_name}</p>
                  <p className={cn('text-xs capitalize', roleColors[user?.role || 'guest'])}>
                    {user?.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Logout
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main 
        className={cn(
          'flex-1 transition-all duration-300',
          'lg:ml-[280px]',
          !sidebarOpen && 'lg:ml-20',
          'pt-16 lg:pt-0'
        )}
      >
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm hidden lg:flex items-center justify-between px-6 sticky top-0 z-30">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{settings.facility_name}</h2>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
