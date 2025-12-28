import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Download, Calendar, Filter, 
  BarChart2, Users, Clock, TrendingUp, Printer
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  getVisitSessions, getVisitors, getPDLs, 
  getDashboardStats 
} from '@/lib/localStorage';
import { DailyVisitorLog } from '@/components/DailyVisitorLog';
import type { VisitSession } from '@/types';

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportType, setReportType] = useState('visits');
  const [showPrintLog, setShowPrintLog] = useState(false);
  const [printDate, setPrintDate] = useState(new Date().toISOString().split('T')[0]);
  const printRef = useRef<HTMLDivElement>(null);
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

  const handlePrintLog = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Daily Visitor Log - ${printDate}</title>
            <style>
              body { margin: 0; padding: 20px; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${printRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
    setShowPrintLog(false);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const generateCSV = () => {
    let csvContent = '';
    
    if (reportType === 'visits') {
      csvContent = 'Date,Time In,Time Out,Visitor Name,Visitor Code,PDL Name,PDL Code,Visit Type,Duration\n';
      filteredSessions.forEach(session => {
        const visitor = visitors.find(v => v.id === session.visitor_id);
        const pdl = pdls.find(p => p.id === session.pdl_id);
        const durationMins = session.time_out 
          ? Math.round((new Date(session.time_out).getTime() - new Date(session.time_in).getTime()) / 60000)
          : null;
        
        csvContent += `${new Date(session.time_in).toLocaleDateString()},`;
        csvContent += `${new Date(session.time_in).toLocaleTimeString()},`;
        csvContent += `${session.time_out ? new Date(session.time_out).toLocaleTimeString() : 'N/A'},`;
        csvContent += `"${visitor?.first_name} ${visitor?.last_name}",`;
        csvContent += `${visitor?.visitor_code},`;
        csvContent += `"${pdl?.first_name} ${pdl?.last_name}",`;
        csvContent += `${pdl?.pdl_code},`;
        csvContent += `${session.visit_type},`;
        csvContent += `${durationMins !== null ? formatDuration(durationMins) : 'Ongoing'}\n`;
      });
    } else if (reportType === 'visitors') {
      csvContent = 'Visitor Code,Name,Gender,Age,Contact,Address,Status,Created Date\n';
      visitors.forEach(visitor => {
        const age = visitor.date_of_birth ? Math.floor((Date.now() - new Date(visitor.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A';
        csvContent += `${visitor.visitor_code},`;
        csvContent += `"${visitor.first_name} ${visitor.last_name}",`;
        csvContent += `${visitor.gender},`;
        csvContent += `${age},`;
        csvContent += `${visitor.contact_number},`;
        csvContent += `"${visitor.address}",`;
        csvContent += `${visitor.status},`;
        csvContent += `${new Date(visitor.created_at).toLocaleDateString()}\n`;
      });
    } else if (reportType === 'pdl') {
      csvContent = 'PDL Code,Name,Gender,Crimes/Cases,Status,Date of Commit\n';
      pdls.forEach(pdl => {
        const crimesStr = pdl.crimes?.map(c => `${c.offense} (${c.case_number})`).join('; ') || 'N/A';
        csvContent += `${pdl.pdl_code},`;
        csvContent += `"${pdl.first_name} ${pdl.last_name}",`;
        csvContent += `${pdl.gender},`;
        csvContent += `"${crimesStr}",`;
        csvContent += `${pdl.status},`;
        csvContent += `${new Date(pdl.date_of_commit).toLocaleDateString()}\n`;
      });
    } else if (reportType === 'visit_type') {
      csvContent = 'Visit Type,Count,Percentage\n';
      const regular = filteredSessions.filter(s => s.visit_type === 'regular').length;
      const conjugal = filteredSessions.filter(s => s.visit_type === 'conjugal').length;
      const total = filteredSessions.length || 1;
      csvContent += `Regular,${regular},${((regular/total)*100).toFixed(1)}%\n`;
      csvContent += `Conjugal,${conjugal},${((conjugal/total)*100).toFixed(1)}%\n`;
    } else if (reportType === 'age') {
      csvContent = 'Age Group,Visitor Count\n';
      const ageGroups: Record<string, number> = { '0-17': 0, '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 };
      visitors.forEach(v => {
        if (!v.date_of_birth) return;
        const age = Math.floor((Date.now() - new Date(v.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) ageGroups['0-17']++;
        else if (age <= 25) ageGroups['18-25']++;
        else if (age <= 35) ageGroups['26-35']++;
        else if (age <= 45) ageGroups['36-45']++;
        else if (age <= 55) ageGroups['46-55']++;
        else ageGroups['56+']++;
      });
      Object.entries(ageGroups).forEach(([group, count]) => {
        csvContent += `${group},${count}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `watchguard-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
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
        <Button onClick={() => setShowPrintLog(true)} variant="outline" className="gap-2">
          <Printer className="w-5 h-5" />
          Print Daily Log
        </Button>
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
                  <SelectItem value="visit_type">By Visit Type</SelectItem>
                  <SelectItem value="age">By Age Group</SelectItem>
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

      {/* Print Daily Log Dialog */}
      <Dialog open={showPrintLog} onOpenChange={setShowPrintLog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto glass-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              Print Daily Visitor Log
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Label>Select Date:</Label>
              <Input
                type="date"
                value={printDate}
                onChange={(e) => setPrintDate(e.target.value)}
                className="input-field w-48"
              />
              <Button onClick={handlePrintLog} className="btn-scanner">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
            <div className="overflow-x-auto border border-border rounded-lg">
              <div ref={printRef}>
                <DailyVisitorLog date={new Date(printDate)} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    const durationMins = session.time_out 
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
                        <td>{durationMins !== null ? formatDuration(durationMins) : <Badge className="status-pending">Ongoing</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {reportType === 'visit_type' && (
              <div className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Visit Type Breakdown</h3>
                {(() => {
                  const regular = filteredSessions.filter(s => s.visit_type === 'regular').length;
                  const conjugal = filteredSessions.filter(s => s.visit_type === 'conjugal').length;
                  const total = filteredSessions.length || 1;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-info/10 border border-info/30">
                        <p className="text-sm text-muted-foreground">Regular Visits</p>
                        <p className="text-3xl font-bold text-info">{regular}</p>
                        <p className="text-sm text-muted-foreground">{((regular/total)*100).toFixed(1)}% of total</p>
                      </div>
                      <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                        <p className="text-sm text-muted-foreground">Conjugal Visits</p>
                        <p className="text-3xl font-bold text-success">{conjugal}</p>
                        <p className="text-sm text-muted-foreground">{((conjugal/total)*100).toFixed(1)}% of total</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {reportType === 'age' && (
              <div className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Visitor Age Distribution</h3>
                {(() => {
                  const ageGroups: Record<string, number> = { '0-17': 0, '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 };
                  visitors.forEach(v => {
                    if (!v.date_of_birth) return;
                    const age = Math.floor((Date.now() - new Date(v.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    if (age < 18) ageGroups['0-17']++;
                    else if (age <= 25) ageGroups['18-25']++;
                    else if (age <= 35) ageGroups['26-35']++;
                    else if (age <= 45) ageGroups['36-45']++;
                    else if (age <= 55) ageGroups['46-55']++;
                    else ageGroups['56+']++;
                  });
                  const maxCount = Math.max(...Object.values(ageGroups)) || 1;
                  return (
                    <div className="space-y-3">
                      {Object.entries(ageGroups).map(([group, count]) => (
                        <div key={group} className="flex items-center gap-4">
                          <span className="w-16 text-sm font-medium">{group}</span>
                          <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="w-12 text-sm text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {reportType === 'visitors' && (
              <table className="data-table">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Age</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.slice(0, 50).map(visitor => {
                    const age = visitor.date_of_birth ? Math.floor((Date.now() - new Date(visitor.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
                    return (
                      <tr key={visitor.id}>
                        <td className="font-mono text-primary">{visitor.visitor_code}</td>
                        <td>{visitor.first_name} {visitor.last_name}</td>
                        <td className="capitalize">{visitor.gender}</td>
                        <td>{age !== null ? `${age} yrs` : '-'}</td>
                        <td>{visitor.contact_number}</td>
                        <td>
                          <Badge className={visitor.status === 'active' ? 'status-active' : 'status-rejected'}>
                            {visitor.status}
                          </Badge>
                        </td>
                        <td>{new Date(visitor.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
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
                    <th>Case No.</th>
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
                      <td>{pdl.crimes?.length || 0} case(s)</td>
                      <td>
                        <Badge className={
                          pdl.status === 'detained' ? 'status-detained' :
                          pdl.status === 'released' ? 'status-released' :
                          pdl.status === 'deceased' ? 'status-blacklisted' : 'status-pending'
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
