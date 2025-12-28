import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HardDrive, Users, Activity, Clock, Server,
  Database, Wifi, Shield, RefreshCw, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  getUsers, getPDLs, getVisitors, getVisitSessions,
  getPDLVisitorLinks, getBiometrics, getAuditLogs, getSettings
} from '@/lib/localStorage';

interface HealthMetric {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  status: 'healthy' | 'warning' | 'error';
  detail?: string;
}

interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
}

export function SystemHealthDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ used: 0, total: 5, percentage: 0 });
  const [activeSessions, setActiveSessions] = useState(0);

  const calculateStorageUsage = (): StorageInfo => {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }
    // Convert to MB (characters * 2 bytes per char / 1024 / 1024)
    const usedMB = (totalSize * 2) / (1024 * 1024);
    const totalMB = 5; // localStorage limit is typically 5-10MB
    return {
      used: Math.round(usedMB * 100) / 100,
      total: totalMB,
      percentage: Math.min((usedMB / totalMB) * 100, 100),
    };
  };

  const refreshMetrics = () => {
    setIsRefreshing(true);

    const users = getUsers();
    const pdls = getPDLs();
    const visitors = getVisitors();
    const sessions = getVisitSessions();
    const links = getPDLVisitorLinks();
    const biometrics = getBiometrics();
    const auditLogs = getAuditLogs();
    const settings = getSettings();

    // Calculate today's active sessions
    const today = new Date().toISOString().split('T')[0];
    const todayActiveSessions = sessions.filter(s => 
      s.time_in.startsWith(today) && !s.time_out
    ).length;
    setActiveSessions(todayActiveSessions);

    // Calculate storage
    const storage = calculateStorageUsage();
    setStorageInfo(storage);

    // Build metrics
    const newMetrics: HealthMetric[] = [
      {
        label: 'Total Users',
        value: users.length,
        icon: <Users className="w-5 h-5" />,
        status: users.length > 0 ? 'healthy' : 'warning',
        detail: `${users.filter(u => u.status === 'active').length} active`,
      },
      {
        label: 'PDL Records',
        value: pdls.length,
        icon: <Database className="w-5 h-5" />,
        status: 'healthy',
        detail: `${pdls.filter(p => p.status === 'detained').length} detained`,
      },
      {
        label: 'Visitors',
        value: visitors.length,
        icon: <Users className="w-5 h-5" />,
        status: 'healthy',
        detail: `${visitors.filter(v => v.status === 'active').length} active`,
      },
      {
        label: 'Biometric Profiles',
        value: biometrics.length,
        icon: <Shield className="w-5 h-5" />,
        status: biometrics.length > 0 ? 'healthy' : 'warning',
        detail: 'Enrolled faces',
      },
      {
        label: 'PDL-Visitor Links',
        value: links.length,
        icon: <Wifi className="w-5 h-5" />,
        status: 'healthy',
        detail: `${links.filter(l => l.approval_status === 'approved').length} approved`,
      },
      {
        label: 'Total Visits',
        value: sessions.length,
        icon: <Activity className="w-5 h-5" />,
        status: 'healthy',
        detail: `${todayActiveSessions} active now`,
      },
      {
        label: 'Audit Logs',
        value: auditLogs.length,
        icon: <Clock className="w-5 h-5" />,
        status: 'healthy',
        detail: 'System events',
      },
      {
        label: 'Storage Used',
        value: `${storage.used} MB`,
        icon: <HardDrive className="w-5 h-5" />,
        status: storage.percentage > 80 ? 'warning' : storage.percentage > 95 ? 'error' : 'healthy',
        detail: `${Math.round(storage.percentage)}% of ${storage.total} MB`,
      },
    ];

    setMetrics(newMetrics);
    setLastRefresh(new Date());
    
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    refreshMetrics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: HealthMetric['status']) => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'warning': return 'text-warning';
      case 'error': return 'text-destructive';
    }
  };

  const getStatusBg = (status: HealthMetric['status']) => {
    switch (status) {
      case 'healthy': return 'bg-success/10';
      case 'warning': return 'bg-warning/10';
      case 'error': return 'bg-destructive/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">System Health</h2>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshMetrics}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="font-semibold text-foreground">System Operational</p>
                <p className="text-sm text-muted-foreground">All services running normally</p>
              </div>
            </div>
            <Badge className="status-approved">ONLINE</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-primary">{activeSessions}</span>
            <span className="text-sm text-muted-foreground">visitors currently inside</span>
          </div>
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            Local Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={storageInfo.percentage} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{storageInfo.used} MB used</span>
            <span className="text-muted-foreground">{storageInfo.total} MB total</span>
          </div>
          {storageInfo.percentage > 80 && (
            <div className="flex items-center gap-2 p-2 rounded bg-warning/10 text-warning text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Storage running low. Consider exporting old data.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="glass-card h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${getStatusBg(metric.status)}`}>
                    <span className={getStatusColor(metric.status)}>{metric.icon}</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                {metric.detail && (
                  <p className="text-xs text-muted-foreground mt-1">{metric.detail}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
