import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Clock, UserCheck, AlertTriangle, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getDashboardStats, getPDLVisitorLinks, getVisitors, getPDLs, getActiveSessions } from '@/lib/localStorage';
import { format } from 'date-fns';

export interface Notification {
  id: string;
  type: 'visitor_arrived' | 'pending_approval' | 'session_active' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Safe version that returns null if outside provider
function useNotificationsSafe() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refreshNotifications = useCallback(() => {
    const newNotifications: Notification[] = [];
    const stats = getDashboardStats();
    const links = getPDLVisitorLinks();
    const visitors = getVisitors();
    const pdls = getPDLs();
    const activeSessions = getActiveSessions();

    // Pending approvals notification
    if (stats.pending_approvals > 0) {
      newNotifications.push({
        id: 'pending-approvals',
        type: 'pending_approval',
        title: 'Pending Kin Dalaw Approvals',
        message: `${stats.pending_approvals} link${stats.pending_approvals > 1 ? 's' : ''} awaiting approval`,
        timestamp: new Date(),
        read: false,
      });
    }

    // Active sessions notification
    if (activeSessions.length > 0) {
      newNotifications.push({
        id: 'active-sessions',
        type: 'session_active',
        title: 'Active Visits',
        message: `${activeSessions.length} visitor${activeSessions.length > 1 ? 's' : ''} currently inside`,
        timestamp: new Date(),
        read: false,
      });
    }

    // Recent arrivals (last 30 minutes)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentArrivals = activeSessions.filter(s => new Date(s.time_in) > thirtyMinAgo);
    
    recentArrivals.forEach(session => {
      const visitor = visitors.find(v => v.id === session.visitor_id);
      const pdl = pdls.find(p => p.id === session.pdl_id);
      if (visitor && pdl) {
        newNotifications.push({
          id: `arrival-${session.id}`,
          type: 'visitor_arrived',
          title: 'Visitor Arrived',
          message: `${visitor.first_name} ${visitor.last_name} → ${pdl.first_name} ${pdl.last_name}`,
          timestamp: new Date(session.time_in),
          read: false,
          data: { sessionId: session.id }
        });
      }
    });

    setNotifications(prev => {
      // Merge with existing, keeping read status
      const merged = newNotifications.map(n => {
        const existing = prev.find(p => p.id === n.id);
        return existing ? { ...n, read: existing.read } : n;
      });
      return merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });
  }, []);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      refreshNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function NotificationBell() {
  const context = useNotificationsSafe();
  const [open, setOpen] = useState(false);

  // If context is not available, render a simple bell without notifications
  if (!context) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="w-5 h-5 text-muted-foreground" />
      </Button>
    );
  }

  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = context;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'visitor_arrived': return <UserCheck className="w-4 h-4 text-success" />;
      case 'pending_approval': return <Clock className="w-4 h-4 text-warning" />;
      case 'session_active': return <Users className="w-4 h-4 text-info" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-foreground">Notifications</h4>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
                <Check className="w-3 h-3 mr-1" />
                Read All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7 text-muted-foreground">
                Clear
              </Button>
            </div>
          )}
        </div>
        <ScrollArea className="max-h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {format(notification.timestamp, 'h:mm a')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
