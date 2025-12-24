import { motion } from 'framer-motion';
import { 
  BarChart3, TrendingUp, Users, Clock, Calendar,
  PieChart as PieChartIcon, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend 
} from 'recharts';
import { getAnalyticsData, getDashboardStats, getVisitSessions, getPDLs, getVisitors } from '@/lib/localStorage';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function AnalyticsPage() {
  const analytics = getAnalyticsData();
  const stats = getDashboardStats();
  const sessions = getVisitSessions();
  const pdls = getPDLs();
  const visitors = getVisitors();

  // Monthly trend data
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: now });
  
  const monthlyTrend = daysInMonth.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const daySessions = sessions.filter(s => s.time_in.startsWith(dayStr));
    return {
      date: format(day, 'MMM d'),
      visits: daySessions.length,
      regular: daySessions.filter(s => s.visit_type === 'regular').length,
      conjugal: daySessions.filter(s => s.visit_type === 'conjugal').length,
    };
  });

  // Category distribution
  const visitTypeData = [
    { name: 'Regular', value: sessions.filter(s => s.visit_type === 'regular').length, color: 'hsl(199, 89%, 48%)' },
    { name: 'Conjugal', value: sessions.filter(s => s.visit_type === 'conjugal').length, color: 'hsl(45, 93%, 58%)' },
  ];

  // Status distribution
  const pdlStatusData = [
    { name: 'Detained', value: pdls.filter(p => p.status === 'detained').length, color: 'hsl(217, 33%, 50%)' },
    { name: 'Released', value: pdls.filter(p => p.status === 'released').length, color: 'hsl(142, 76%, 36%)' },
    { name: 'Transferred', value: pdls.filter(p => p.status === 'transferred').length, color: 'hsl(38, 92%, 50%)' },
  ];

  const visitorStatusData = [
    { name: 'Active', value: visitors.filter(v => v.status === 'active').length, color: 'hsl(199, 89%, 48%)' },
    { name: 'Inactive', value: visitors.filter(v => v.status === 'inactive').length, color: 'hsl(217, 33%, 50%)' },
    { name: 'Blacklisted', value: visitors.filter(v => v.status === 'blacklisted').length, color: 'hsl(0, 72%, 51%)' },
  ];

  // Growth calculations
  const lastWeekSessions = sessions.filter(s => {
    const date = parseISO(s.time_in);
    return date >= subDays(now, 14) && date < subDays(now, 7);
  }).length;
  const thisWeekSessions = sessions.filter(s => {
    const date = parseISO(s.time_in);
    return date >= subDays(now, 7);
  }).length;
  const weekGrowth = lastWeekSessions > 0 
    ? Math.round(((thisWeekSessions - lastWeekSessions) / lastWeekSessions) * 100) 
    : 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive insights and statistics
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Visits', value: sessions.length, icon: Clock, change: `${weekGrowth}%`, up: weekGrowth >= 0 },
          { label: 'This Month', value: stats.visits_this_month, icon: Calendar, change: 'Current', up: true },
          { label: 'Active PDLs', value: stats.total_pdl, icon: Users, change: `${pdls.length} total`, up: true },
          { label: 'Registered Visitors', value: stats.total_visitors, icon: Activity, change: `${visitors.length} total`, up: true },
        ].map((stat) => (
          <Card key={stat.label} className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className="w-5 h-5 text-primary" />
                {stat.up ? (
                  <span className="text-success text-xs flex items-center">
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.change}
                  </span>
                ) : (
                  <span className="text-destructive text-xs flex items-center">
                    <ArrowDownRight className="w-3 h-3" />
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Monthly Visit Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <defs>
                      <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(45, 93%, 58%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(45, 93%, 58%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 20%)" />
                    <XAxis dataKey="date" stroke="hsl(215, 20%, 55%)" fontSize={11} />
                    <YAxis stroke="hsl(215, 20%, 55%)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222, 47%, 10%)',
                        border: '1px solid hsl(217, 33%, 20%)',
                        borderRadius: '8px',
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="visits" 
                      stroke="hsl(45, 93%, 58%)" 
                      fillOpacity={1} 
                      fill="url(#colorVisits)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Weekly Comparison */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Weekly Visit Types
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
                    <Legend />
                    <Bar dataKey="regular" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} name="Regular" />
                    <Bar dataKey="conjugal" fill="hsl(45, 93%, 58%)" radius={[4, 4, 0, 0]} name="Conjugal" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 - Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Visit Type Distribution */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-primary" />
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
                      innerRadius={50}
                      outerRadius={70}
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
              <div className="flex justify-center gap-4 mt-2">
                {visitTypeData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-muted-foreground">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* PDL Status */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                PDL Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pdlStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pdlStatusData.map((entry, index) => (
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
              <div className="flex justify-center gap-3 mt-2 flex-wrap">
                {pdlStatusData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-muted-foreground">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Visitor Status */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Visitor Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={visitorStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {visitorStatusData.map((entry, index) => (
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
              <div className="flex justify-center gap-3 mt-2 flex-wrap">
                {visitorStatusData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-muted-foreground">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Peak Visit Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.peakHours.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No visit data available</p>
              ) : (
                <div className="space-y-3">
                  {analytics.peakHours.map((hour, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="font-mono text-sm text-primary w-16">{hour.hour}</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-yellow-400 rounded-full"
                          style={{ width: `${(hour.visits / Math.max(...analytics.peakHours.map(h => h.visits))) * 100}%` }}
                        />
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {hour.visits}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top PDLs */}
        <motion.div variants={item}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Most Visited PDLs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.topPDLs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No visit data available</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topPDLs.map((pdl, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-foreground truncate">{pdl.name}</span>
                      <Badge className="status-active">
                        {pdl.visits} visits
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
