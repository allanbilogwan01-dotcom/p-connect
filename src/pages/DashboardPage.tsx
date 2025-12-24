import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Users, UserCheck, Clock, AlertCircle, TrendingUp, 
  Activity, Calendar, ArrowUpRight, Plus, LogIn, UserPlus, Link2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardStats, getAnalyticsData, getActiveSessions, getVisitors, getPDLs } from '@/lib/localStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const stats = getDashboardStats();
  const analytics = getAnalyticsData();
  const activeSessions = getActiveSessions();
  const visitors = getVisitors();
  const pdls = getPDLs();

  const statCards = [
    {
      title: 'Total PDLs',
      value: stats.total_pdl,
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
      change: '+12%',
      changeType: 'up',
    },
    {
      title: 'Registered Visitors',
      value: stats.total_visitors,
      icon: UserCheck,
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: '+8%',
      changeType: 'up',
    },
    {
      title: "Today's Visits",
      value: stats.todays_visits,
      icon: Clock,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: stats.active_sessions > 0 ? `${stats.active_sessions} active` : 'None active',
      changeType: 'neutral',
    },
    {
      title: 'Pending Approvals',
      value: stats.pending_approvals,
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      change: 'Requires action',
      changeType: stats.pending_approvals > 0 ? 'warning' : 'neutral',
    },
  ];

  const visitTypeData = [
    { name: 'Regular', value: analytics.weeklyData.reduce((a, b) => a + b.regular, 0), color: 'hsl(199, 89%, 48%)' },
    { name: 'Conjugal', value: analytics.weeklyData.reduce((a, b) => a + b.conjugal, 0), color: 'hsl(45, 93%, 58%)' },
  ];

  const quickActions = [
    { 
      label: 'New Visitor', 
      icon: UserPlus, 
      path: '/visitors', 
      color: 'bg-success/10 text-success hover:bg-success/20',
      permission: 'manage_visitors',
    },
    { 
      label: 'Add PDL', 
      icon: Plus, 
      path: '/pdl', 
      color: 'bg-info/10 text-info hover:bg-info/20',
      permission: 'manage_pdl',
    },
    { 
      label: 'Time In/Out', 
      icon: LogIn, 
      path: '/visitation', 
      color: 'bg-primary/10 text-primary hover:bg-primary/20',
      permission: 'operate_visitation',
    },
    { 
      label: 'Link Kin', 
      icon: Link2, 
      path: '/kin-dalaw', 
      color: 'bg-warning/10 text-warning hover:bg-warning/20',
      permission: 'create_kin_dalaw',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Welcome Header */}
      <motion.div variants={item} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Welcome back, <span className="gold-text">{user?.full_name?.split(' ')[0]}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening at the facility today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Activity className="w-3 h-3 mr-1" />
            {stats.active_sessions} Active Session{stats.active_sessions !== 1 ? 's' : ''}
          </Badge>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.filter(action => hasPermission(action.permission)).map((action) => (
            <Link key={action.path} to={action.path}>
              <Button 
                variant="ghost" 
                className={`w-full h-auto py-4 flex flex-col items-center gap-2 ${action.color} transition-all`}
              >
                <action.icon className="w-6 h-6" />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                {stat.changeType === 'up' && (
                  <div className="flex items-center text-success text-sm">
                    <ArrowUpRight className="w-4 h-4" />
                    {stat.change}
                  </div>
                )}
                {stat.changeType === 'warning' && (
                  <Badge variant="outline" className="status-pending text-xs">
                    {stat.change}
                  </Badge>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Visits Chart */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Weekly Visit Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 20%)" />
                    <XAxis dataKey="day" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222, 47%, 10%)',
                        border: '1px solid hsl(217, 33%, 20%)',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="regular" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} name="Regular" />
                    <Bar dataKey="conjugal" fill="hsl(45, 93%, 58%)" radius={[4, 4, 0, 0]} name="Conjugal" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Visit Type Distribution */}
        <motion.div variants={item}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Visit Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={visitTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {visitTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222, 47%, 10%)',
                        border: '1px solid hsl(217, 33%, 20%)',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                {visitTypeData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-muted-foreground">{entry.name}</span>
                    <span className="text-sm font-semibold text-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Active Sessions
              </CardTitle>
              <Link to="/visitation">
                <Button variant="ghost" size="sm" className="text-primary">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active sessions at the moment</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[250px] overflow-y-auto scrollbar-thin">
                  {activeSessions.slice(0, 5).map((session) => {
                    const visitor = visitors.find(v => v.id === session.visitor_id);
                    const pdl = pdls.find(p => p.id === session.pdl_id);
                    return (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-semibold text-sm">
                              {visitor?.first_name?.charAt(0)}{visitor?.last_name?.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {visitor?.first_name} {visitor?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Visiting: {pdl?.first_name} {pdl?.last_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={session.visit_type === 'conjugal' ? 'status-approved' : 'status-active'}>
                            {session.visit_type}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(session.time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Quick Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold text-foreground">{stats.visits_this_week}</p>
                  <p className="text-sm text-muted-foreground">Visits This Week</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold text-foreground">{stats.visits_this_month}</p>
                  <p className="text-sm text-muted-foreground">Visits This Month</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Top Visitors</h4>
                {analytics.topVisitors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No visit data yet</p>
                ) : (
                  analytics.topVisitors.slice(0, 3).map((visitor, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-mono text-sm">{i + 1}.</span>
                        <span className="text-sm text-foreground">{visitor.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {visitor.visits} visits
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
