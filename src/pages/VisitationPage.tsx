import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, Camera, QrCode, Search, LogIn, LogOut,
  User, AlertCircle, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  getVisitorByCode, getVisitors, getPDLs, getPDLVisitorLinks,
  getOpenSession, createVisitSession, updateVisitSession,
  getActiveSessions, getCompletedTodaySessions, createAuditLog,
  getSettings
} from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { CONJUGAL_RELATIONSHIPS, RELATIONSHIP_LABELS } from '@/types';
import type { Visitor, PDLVisitorLink, VisitType, TimeMethod } from '@/types';
import { Html5Qrcode } from 'html5-qrcode';

export default function VisitationPage() {
  const [activeTab, setActiveTab] = useState('time-in');
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [foundVisitor, setFoundVisitor] = useState<Visitor | null>(null);
  const [selectedLink, setSelectedLink] = useState<PDLVisitorLink | null>(null);
  const [visitType, setVisitType] = useState<VisitType>('regular');
  const [activeSessions, setActiveSessions] = useState(getActiveSessions());
  const [completedSessions, setCompletedSessions] = useState(getCompletedTodaySessions());
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const pdls = getPDLs();
  const visitors = getVisitors();
  const links = getPDLVisitorLinks();
  const settings = getSettings();

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSessions(getActiveSessions());
      setCompletedSessions(getCompletedTodaySessions());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const startQRScanner = async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleCodeScanned(decodedText, 'qr_scan');
          stopQRScanner();
        },
        () => {}
      );
      setScannerActive(true);
    } catch (error) {
      toast({
        title: 'Scanner Error',
        description: 'Unable to start QR scanner. Check camera permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopQRScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  const handleCodeScanned = (code: string, method: TimeMethod) => {
    const visitor = getVisitorByCode(code);
    if (!visitor) {
      toast({
        title: 'Visitor Not Found',
        description: `No visitor found with code: ${code}`,
        variant: 'destructive',
      });
      return;
    }

    if (visitor.status !== 'active') {
      toast({
        title: 'Visitor Inactive',
        description: 'This visitor is not active and cannot visit.',
        variant: 'destructive',
      });
      return;
    }

    setFoundVisitor(visitor);
    
    // Check for open session
    const openSession = getOpenSession(visitor.id);
    if (openSession) {
      // Time out mode
      setActiveTab('time-out');
      setSelectedLink(links.find(l => l.id === openSession.pdl_visitor_link_id) || null);
    } else {
      // Time in mode
      setActiveTab('time-in');
      // Get approved links for this visitor
      const approvedLinks = links.filter(l => 
        l.visitor_id === visitor.id && l.approval_status === 'approved'
      );
      if (approvedLinks.length === 0) {
        toast({
          title: 'No Approved Links',
          description: 'This visitor has no approved PDL links.',
          variant: 'destructive',
        });
        setFoundVisitor(null);
        return;
      }
      if (approvedLinks.length === 1) {
        setSelectedLink(approvedLinks[0]);
        // Check if conjugal eligible
        if (settings.conjugal_relationships.includes(approvedLinks[0].relationship)) {
          setVisitType('regular'); // Let them choose
        } else {
          setVisitType('regular');
        }
      }
    }
  };

  const handleManualSearch = () => {
    if (manualCode.length !== 10) {
      toast({
        title: 'Invalid Code',
        description: 'Visitor code must be exactly 10 digits.',
        variant: 'destructive',
      });
      return;
    }
    handleCodeScanned(manualCode, 'manual_id');
    setManualCode('');
  };

  const handleTimeIn = () => {
    if (!foundVisitor || !selectedLink) return;

    // Validate conjugal visit eligibility
    if (visitType === 'conjugal' && !settings.conjugal_relationships.includes(selectedLink.relationship)) {
      toast({
        title: 'Conjugal Not Allowed',
        description: 'This relationship type is not eligible for conjugal visits.',
        variant: 'destructive',
      });
      return;
    }

    const session = createVisitSession({
      visitor_id: foundVisitor.id,
      pdl_id: selectedLink.pdl_id,
      pdl_visitor_link_id: selectedLink.id,
      visit_type: visitType,
      time_in: new Date().toISOString(),
      time_in_method: 'manual_id',
      operator_id: user?.id || '',
    });

    createAuditLog({
      user_id: user?.id || '',
      action: 'visit_time_in',
      target_type: 'visit_session',
      target_id: session.id,
    });

    toast({
      title: 'Time In Recorded',
      description: `${foundVisitor.first_name} ${foundVisitor.last_name} has been timed in.`,
    });

    setActiveSessions(getActiveSessions());
    resetSelection();
  };

  const handleTimeOut = (sessionId?: string) => {
    let targetSession;
    
    if (sessionId) {
      targetSession = activeSessions.find(s => s.id === sessionId);
    } else if (foundVisitor) {
      targetSession = getOpenSession(foundVisitor.id);
    }

    if (!targetSession) {
      toast({
        title: 'No Open Session',
        description: 'No active session found for this visitor.',
        variant: 'destructive',
      });
      return;
    }

    updateVisitSession(targetSession.id, {
      time_out: new Date().toISOString(),
      time_out_method: 'manual_id',
    });

    createAuditLog({
      user_id: user?.id || '',
      action: 'visit_time_out',
      target_type: 'visit_session',
      target_id: targetSession.id,
    });

    const visitor = visitors.find(v => v.id === targetSession.visitor_id);
    toast({
      title: 'Time Out Recorded',
      description: `${visitor?.first_name} ${visitor?.last_name} has been timed out.`,
    });

    setActiveSessions(getActiveSessions());
    setCompletedSessions(getCompletedTodaySessions());
    resetSelection();
  };

  const resetSelection = () => {
    setFoundVisitor(null);
    setSelectedLink(null);
    setVisitType('regular');
  };

  const getVisitorLinks = (visitorId: string) => {
    return links.filter(l => l.visitor_id === visitorId && l.approval_status === 'approved');
  };

  const isConjugalEligible = (relationship: string) => {
    return settings.conjugal_relationships.includes(relationship as any);
  };

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
            <Clock className="w-8 h-8 text-primary" />
            Visitation Operations
          </h1>
          <p className="text-muted-foreground mt-1">
            Process visitor time-in and time-out
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="status-active text-sm px-4 py-2">
            <Clock className="w-4 h-4 mr-2" />
            {activeSessions.length} Active Session{activeSessions.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Visitor Identification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scanner Tabs */}
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Manual ID
                  </TabsTrigger>
                  <TabsTrigger value="qr" className="flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    QR Scan
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="manual" className="mt-4">
                  <div className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit visitor code"
                      className="input-field font-mono text-lg"
                      maxLength={10}
                    />
                    <Button 
                      onClick={handleManualSearch}
                      className="btn-scanner"
                      disabled={manualCode.length !== 10}
                    >
                      <Search className="w-5 h-5" />
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="qr" className="mt-4">
                  <div className="space-y-4">
                    {scannerActive ? (
                      <div className="space-y-4">
                        <div id="qr-reader" className="scanner-frame mx-auto max-w-sm" />
                        <Button 
                          variant="outline" 
                          onClick={stopQRScanner}
                          className="w-full"
                        >
                          Stop Scanner
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={startQRScanner}
                        className="w-full btn-scanner h-24 text-lg"
                      >
                        <QrCode className="w-8 h-8 mr-3" />
                        Start QR Scanner
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Found Visitor */}
              {foundVisitor && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted">
                      {foundVisitor.photo_url ? (
                        <img 
                          src={foundVisitor.photo_url} 
                          alt="Visitor" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-10 h-10 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground">
                        {foundVisitor.first_name} {foundVisitor.last_name}
                      </h3>
                      <p className="font-mono text-primary text-lg">{foundVisitor.visitor_code}</p>
                      <Badge className="status-active mt-2">{foundVisitor.status}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={resetSelection}>
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Select PDL Link */}
                  {!getOpenSession(foundVisitor.id) && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Select PDL to Visit</Label>
                        <Select 
                          value={selectedLink?.id || ''} 
                          onValueChange={(val) => {
                            const link = getVisitorLinks(foundVisitor.id).find(l => l.id === val);
                            setSelectedLink(link || null);
                          }}
                        >
                          <SelectTrigger className="input-field">
                            <SelectValue placeholder="Select PDL" />
                          </SelectTrigger>
                          <SelectContent>
                            {getVisitorLinks(foundVisitor.id).map(link => {
                              const pdl = pdls.find(p => p.id === link.pdl_id);
                              return (
                                <SelectItem key={link.id} value={link.id}>
                                  {pdl?.last_name}, {pdl?.first_name} - {RELATIONSHIP_LABELS[link.relationship]}
                                  {isConjugalEligible(link.relationship) && ' ★'}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedLink && isConjugalEligible(selectedLink.relationship) && (
                        <div className="space-y-2">
                          <Label>Visit Type</Label>
                          <Select value={visitType} onValueChange={(val: VisitType) => setVisitType(val)}>
                            <SelectTrigger className="input-field">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="regular">Regular Visit</SelectItem>
                              <SelectItem value="conjugal">Conjugal Visit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Button 
                        onClick={handleTimeIn}
                        disabled={!selectedLink}
                        className="w-full btn-scanner h-12"
                      >
                        <LogIn className="w-5 h-5 mr-2" />
                        Record Time In
                      </Button>
                    </div>
                  )}

                  {/* Time Out for open session */}
                  {getOpenSession(foundVisitor.id) && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Active session found. Time in: {new Date(getOpenSession(foundVisitor.id)!.time_in).toLocaleTimeString()}
                      </p>
                      <Button 
                        onClick={() => handleTimeOut()}
                        className="w-full bg-destructive hover:bg-destructive/90 h-12"
                      >
                        <LogOut className="w-5 h-5 mr-2" />
                        Record Time Out
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions */}
        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No active sessions</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {activeSessions.map(session => {
                    const visitor = visitors.find(v => v.id === session.visitor_id);
                    const pdl = pdls.find(p => p.id === session.pdl_id);
                    return (
                      <div 
                        key={session.id} 
                        className="p-3 rounded-lg bg-muted/30 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {visitor?.first_name} {visitor?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            → {pdl?.first_name} {pdl?.last_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={session.visit_type === 'conjugal' ? 'status-approved' : 'status-active'} >
                              {session.visit_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(session.time_in).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleTimeOut(session.id)}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-success" />
                Completed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{completedSessions.length}</p>
              <p className="text-sm text-muted-foreground">visits completed</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
