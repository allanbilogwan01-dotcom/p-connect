import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Download, Calendar, Filter, 
  BarChart2, Users, Clock, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  getVisitSessions, getVisitors, getPDLs, 
  getDashboardStats 
} from '@/lib/localStorage';
import type { VisitSession } from '@/types';

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportType, setReportType] = useState('visits');
  const { toast } = useToast();
  
  const sessions = getVisitSessions();
  const visitors = getVisitors();
  const pdls = getPDLs();
  const stats = getDashboardStats();

  const filteredSessions = sessions.filter(s => {
    if (!dateFrom && !dateTo) return true;
    const sessionDate = new Date(s.time_in).toISOString().split('T')[0];
    if (dateFrom && sessionDate < dateFrom) return false;
    if (dateTo && sessionDate > dateTo) return false;
    return true;
  });

  const generateCSV = () => {
    let csvContent = '';
    
    if (reportType === 'visits') {
      csvContent = 'Date,Time In,Time Out,Visitor Name,Visitor Code,PDL Name,PDL Code,Visit Type,Duration\n';
      filteredSessions.forEach(session => {
        const visitor = visitors.find(v => v.id === session.visitor_id);
        const pdl = pdls.find(p => p.id === session.pdl_id);
        const duration = session.time_out 
          ? Math.round((new Date(session.time_out).getTime() - new Date(session.time_in).getTime()) / 60000)
          : 'Ongoing';
        
        csvContent += `${new Date(session.time_in).toLocaleDateString()},`;
        csvContent += `${new Date(session.time_in).toLocaleTimeString()},`;
        csvContent += `${session.time_out ? new Date(session.time_out).toLocaleTimeString() : 'N/A'},`;
        csvContent += `"${visitor?.first_name} ${visitor?.last_name}",`;
        csvContent += `${visitor?.visitor_code},`;
        csvContent += `"${pdl?.first_name} ${pdl?.last_name}",`;
        csvContent += `${pdl?.pdl_code},`;
        csvContent += `${session.visit_type},`;
        csvContent += `${duration}${typeof duration === 'number' ? ' min' : ''}\n`;
      });
    } else if (reportType === 'visitors') {
      csvContent = 'Visitor Code,Name,Gender,Contact,Address,Status,Created Date\n';
      visitors.forEach(visitor => {
        csvContent += `${visitor.visitor_code},`;
        csvContent += `"${visitor.first_name} ${visitor.last_name}",`;
        csvContent += `${visitor.gender},`;
        csvContent += `${visitor.contact_number},`;
        csvContent += `"${visitor.address}",`;
        csvContent += `${visitor.status},`;
        csvContent += `${new Date(visitor.created_at).toLocaleDateString()}\n`;
      });
    } else if (reportType === 'pdl') {
      csvContent = 'PDL Code,Name,Gender,Cell,Crime,Status,Date of Commit\n';
      pdls.forEach(pdl => {
        csvContent += `${pdl.pdl_code},`;
        csvContent += `"${pdl.first_name} ${pdl.last_name}",`;
        csvContent += `${pdl.gender},`;
        csvContent += `${pdl.cell_block}-${pdl.cell_number},`;
        csvContent += `"${pdl.crime || 'N/A'}",`;
        csvContent += `${pdl.status},`;
        csvContent += `${new Date(pdl.date_of_commit).toLocaleDateString()}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `jail-is-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: 'Report Generated',
      description: 'Your report has been downloaded.',
    });
  };

  const reportStats = [
    {
      title: 'Total Visits',
      value: filteredSessions.length,
      icon: Clock,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Regular Visits',
      value: filteredSessions.filter(s => s.visit_type === 'regular').length,
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Conjugal Visits',
      value: filteredSessions.filter(s => s.visit_type === 'conjugal').length,
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Avg Duration',
      value: (() => {
        const completed = filteredSessions.filter(s => s.time_out);
        if (completed.length === 0) return '0m';
        const avgMs = completed.reduce((acc, s) => 
          acc + (new Date(s.time_out!).getTime() - new Date(s.time_in).getTime()), 0
        ) / completed.length;
        return `${Math.round(avgMs / 60000)}m`;
      })(),
      icon: BarChart2,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate and export facility reports
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="input-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visits">Visit Sessions</SelectItem>
                  <SelectItem value="visitors">Visitor List</SelectItem>
                  <SelectItem value="pdl">PDL List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={generateCSV} className="btn-scanner w-full">
                <Download className="w-5 h-5 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {reportType === 'visits' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportStats.map((stat) => (
            <Card key={stat.title} className="stat-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data Preview */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Data Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[400px]">
            {reportType === 'visits' && (
              <table className="data-table">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th>Date</th>
                    <th>Visitor</th>
                    <th>PDL</th>
                    <th>Type</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.slice(0, 50).map(session => {
                    const visitor = visitors.find(v => v.id === session.visitor_id);
                    const pdl = pdls.find(p => p.id === session.pdl_id);
                    const duration = session.time_out 
                      ? Math.round((new Date(session.time_out).getTime() - new Date(session.time_in).getTime()) / 60000)
                      : null;
                    return (
                      <tr key={session.id}>
                        <td>{new Date(session.time_in).toLocaleDateString()}</td>
                        <td>
                          <div>
                            <p className="font-medium">{visitor?.first_name} {visitor?.last_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{visitor?.visitor_code}</p>
                          </div>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium">{pdl?.first_name} {pdl?.last_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{pdl?.pdl_code}</p>
                          </div>
                        </td>
                        <td>
                          <Badge className={session.visit_type === 'conjugal' ? 'status-approved' : 'status-active'}>
                            {session.visit_type}
                          </Badge>
                        </td>
                        <td>{new Date(session.time_in).toLocaleTimeString()}</td>
                        <td>{session.time_out ? new Date(session.time_out).toLocaleTimeString() : '-'}</td>
                        <td>{duration ? `${duration} min` : <Badge className="status-pending">Ongoing</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {reportType === 'visitors' && (
              <table className="data-table">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.slice(0, 50).map(visitor => (
                    <tr key={visitor.id}>
                      <td className="font-mono text-primary">{visitor.visitor_code}</td>
                      <td>{visitor.first_name} {visitor.last_name}</td>
                      <td className="capitalize">{visitor.gender}</td>
                      <td>{visitor.contact_number}</td>
                      <td>
                        <Badge className={visitor.status === 'active' ? 'status-active' : 'status-rejected'}>
                          {visitor.status}
                        </Badge>
                      </td>
                      <td>{new Date(visitor.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'pdl' && (
              <table className="data-table">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th>PDL Code</th>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Cell</th>
                    <th>Status</th>
                    <th>Date of Commit</th>
                  </tr>
                </thead>
                <tbody>
                  {pdls.slice(0, 50).map(pdl => (
                    <tr key={pdl.id}>
                      <td className="font-mono text-primary">{pdl.pdl_code}</td>
                      <td>{pdl.first_name} {pdl.last_name}</td>
                      <td className="capitalize">{pdl.gender}</td>
                      <td>{pdl.cell_block}-{pdl.cell_number}</td>
                      <td>
                        <Badge className={
                          pdl.status === 'detained' ? 'status-detained' :
                          pdl.status === 'released' ? 'status-released' : 'status-pending'
                        }>
                          {pdl.status}
                        </Badge>
                      </td>
                      <td>{new Date(pdl.date_of_commit).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
