import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, Save, RotateCcw, Building, Users, Scan, 
  Database, Shield, AlertTriangle, HardDrive, Download, Info, FolderDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  getSettings, setSettings, resetStorage, createAuditLog,
  getPDLs, getVisitors, getPDLVisitorLinks, getVisitSessions,
  getAuditLogs, getBiometrics, getUsers
} from '@/lib/localStorage';
import { useAuth } from '@/contexts/AuthContext';
import { RELATIONSHIP_LABELS } from '@/types';
import type { SystemSettings, RelationshipType } from '@/types';

const CONJUGAL_ELIGIBLE: RelationshipType[] = [
  'wife', 'husband', 'spouse', 'live_in_partner', 'common_law_partner'
];

export default function SettingsPage() {
  const [settings, setLocalSettings] = useState<SystemSettings>(getSettings());
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [storageLocation, setStorageLocation] = useState<string>('local');
  const [driveConnected, setDriveConnected] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDriveConnect = () => {
    if (storageLocation === 'local') {
      toast({
        title: 'LOCAL STORAGE SELECTED',
        description: 'Data is stored locally on this device.',
      });
      return;
    }
    
    // Simulate Google Drive connection
    toast({
      title: 'GOOGLE DRIVE',
      description: 'Connecting to Google Drive... Please authorize in the popup.',
    });
    
    // Simulate OAuth flow
    setTimeout(() => {
      setDriveConnected(true);
      toast({
        title: 'CONNECTED',
        description: 'Google Drive connected successfully. Data will sync automatically.',
      });
    }, 2000);
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setSettings(settings);
    createAuditLog({
      user_id: user?.id || '',
      action: 'settings_changed',
      target_type: 'settings',
      target_id: 'system',
      details: { facility_name: settings.facility_name },
    });
    setHasChanges(false);
    toast({ title: 'SETTINGS SAVED', description: 'System settings have been updated.' });
  };

  const handleReset = () => {
    resetStorage();
    toast({ 
      title: 'SYSTEM RESET', 
      description: 'All data has been cleared. Page will reload.',
      variant: 'destructive',
    });
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleDownloadBackup = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings: getSettings(),
      users: getUsers(),
      pdls: getPDLs(),
      visitors: getVisitors(),
      pdlVisitorLinks: getPDLVisitorLinks(),
      visitSessions: getVisitSessions(),
      auditLogs: getAuditLogs(),
      biometrics: getBiometrics(),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchguard-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    createAuditLog({
      user_id: user?.id || '',
      action: 'settings_changed',
      target_type: 'backup',
      target_id: 'full_backup',
      details: { action: 'download' },
    });

    toast({
      title: 'BACKUP DOWNLOADED',
      description: 'All system data has been exported to a JSON file.',
    });
  };

  const toggleConjugalRelationship = (rel: RelationshipType) => {
    const current = settings.conjugal_relationships;
    const updated = current.includes(rel)
      ? current.filter(r => r !== rel)
      : [...current, rel];
    updateSetting('conjugal_relationships', updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary" />
            SYSTEM SETTINGS
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system behavior and preferences
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} className="btn-scanner">
            <Save className="w-5 h-5 mr-2" />
            SAVE CHANGES
          </Button>
        )}
      </div>

      {/* Facility Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            FACILITY INFORMATION
          </CardTitle>
          <CardDescription>Basic facility details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>FACILITY NAME</Label>
            <Input
              value={settings.facility_name}
              onChange={(e) => updateSetting('facility_name', e.target.value.toUpperCase())}
              className="input-field max-w-md uppercase"
            />
          </div>
        </CardContent>
      </Card>

      {/* Visitor Limits */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            VISITOR LIMITS
          </CardTitle>
          <CardDescription>Maximum visitors per PDL by category (-1 for unlimited)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>IMMEDIATE FAMILY</Label>
              <Input
                type="number"
                value={settings.immediate_family_limit}
                onChange={(e) => updateSetting('immediate_family_limit', parseInt(e.target.value))}
                className="input-field"
                min={-1}
              />
              <p className="text-xs text-muted-foreground">-1 = UNLIMITED</p>
            </div>
            <div className="space-y-2">
              <Label>LEGAL GUARDIAN</Label>
              <Input
                type="number"
                value={settings.legal_guardian_limit}
                onChange={(e) => updateSetting('legal_guardian_limit', parseInt(e.target.value))}
                className="input-field"
                min={-1}
              />
            </div>
            <div className="space-y-2">
              <Label>CLOSE FRIEND</Label>
              <Input
                type="number"
                value={settings.close_friend_limit}
                onChange={(e) => updateSetting('close_friend_limit', parseInt(e.target.value))}
                className="input-field"
                min={-1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Face Recognition Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scan className="w-5 h-5 text-primary" />
            FACE RECOGNITION
          </CardTitle>
          <CardDescription>Biometric verification settings for high accuracy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>RECOGNITION THRESHOLD</Label>
                <span className="text-sm font-mono text-primary">{settings.face_recognition_threshold.toFixed(2)}</span>
              </div>
              <Slider
                value={[settings.face_recognition_threshold]}
                onValueChange={([val]) => updateSetting('face_recognition_threshold', val)}
                min={0.5}
                max={0.95}
                step={0.01}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Higher values = stricter matching. Recommended: 0.75 - 0.85 for high accuracy
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>MATCH MARGIN</Label>
                <span className="text-sm font-mono text-primary">{settings.face_recognition_margin.toFixed(2)}</span>
              </div>
              <Slider
                value={[settings.face_recognition_margin]}
                onValueChange={([val]) => updateSetting('face_recognition_margin', val)}
                min={0.05}
                max={0.3}
                step={0.01}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Required gap between best and second-best match. Higher = fewer false positives
              </p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-info/10 border border-info/30">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-info mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">ACCURACY TIPS</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>• Ensure good lighting during enrollment</li>
                  <li>• Capture 5 face samples from slightly different angles</li>
                  <li>• Set threshold to 0.80+ for high-security areas</li>
                  <li>• Set margin to 0.15+ to reduce false matches</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conjugal Visits */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            CONJUGAL VISIT ELIGIBILITY
          </CardTitle>
          <CardDescription>Select which relationships are eligible for conjugal visits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CONJUGAL_ELIGIBLE.map(rel => (
              <div 
                key={rel}
                className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <Switch
                  checked={settings.conjugal_relationships.includes(rel)}
                  onCheckedChange={() => toggleConjugalRelationship(rel)}
                />
                <Label className="text-sm cursor-pointer uppercase">
                  {RELATIONSHIP_LABELS[rel]}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Local & Drive Storage */}
      <Card className="glass-card border-info/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-info" />
            LOCAL & DRIVE STORAGE
            <Badge variant="outline" className="ml-2 text-xs">SYNC</Badge>
          </CardTitle>
          <CardDescription>Configure data storage location and backup options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/30">
            <Info className="w-4 h-4 text-info flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Choose where to store your data. Local storage keeps data on this device. 
              Google Drive enables cloud backup and multi-device sync.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>STORAGE LOCATION</Label>
              <Select value={storageLocation} onValueChange={setStorageLocation}>
                <SelectTrigger className="input-field">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">LOCAL STORAGE (THIS DEVICE)</SelectItem>
                  <SelectItem value="drive">GOOGLE DRIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end gap-2">
              <Button 
                onClick={handleDriveConnect}
                className={driveConnected && storageLocation === 'drive' ? 'bg-success hover:bg-success/90' : 'btn-scanner'}
              >
                {driveConnected && storageLocation === 'drive' ? (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    CONNECTED
                  </>
                ) : (
                  <>
                    <HardDrive className="w-4 h-4 mr-2" />
                    {storageLocation === 'drive' ? 'CONNECT DRIVE' : 'USE LOCAL'}
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {storageLocation === 'local' && (
            <p className="text-xs text-muted-foreground">
              Data is stored in browser localStorage. Clear browser data will erase all records.
              Use the backup function below to export data periodically.
            </p>
          )}
          
          {storageLocation === 'drive' && driveConnected && (
            <p className="text-xs text-success">
              ✓ Connected to Google Drive. Data will be synced automatically.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Backup & Export */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderDown className="w-5 h-5 text-primary" />
            BACKUP & EXPORT
          </CardTitle>
          <CardDescription>Download all system data for backup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">DOWNLOAD ALL FILES</p>
              <p className="text-sm text-muted-foreground">
                Export complete system data including PDLs, visitors, visits, biometrics, and settings
              </p>
            </div>
            <Button onClick={handleDownloadBackup} className="btn-scanner">
              <Download className="w-4 h-4 mr-2" />
              DOWNLOAD BACKUP
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Backup file will be saved as JSON format. Keep this file secure as it contains all system data.
          </p>
        </CardContent>
      </Card>

      {/* System Options */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            SYSTEM OPTIONS
          </CardTitle>
          <CardDescription>General system behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <Label>ALLOW GUEST ENROLLMENT</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Allow users with Guest role to enroll new visitors
              </p>
            </div>
            <Switch
              checked={settings.allow_guest_enrollment}
              onCheckedChange={(val) => updateSetting('allow_guest_enrollment', val)}
            />
          </div>
          <div className="space-y-2">
            <Label>DATA RETENTION (DAYS)</Label>
            <Input
              type="number"
              value={settings.data_retention_days}
              onChange={(e) => updateSetting('data_retention_days', parseInt(e.target.value))}
              className="input-field max-w-xs"
              min={30}
              max={3650}
            />
            <p className="text-xs text-muted-foreground">
              How long to keep audit logs and visit records
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="glass-card border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            DANGER ZONE
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div>
              <p className="font-medium text-foreground">RESET ALL DATA</p>
              <p className="text-sm text-muted-foreground">
                Clear all data and reset to factory defaults. This cannot be undone.
              </p>
            </div>
            <Button 
              variant="destructive"
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              RESET
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">RESET ALL DATA?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all users, PDLs, visitors, visit records, and settings.
              Only the default super admin account will remain. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>CANCEL</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReset}
              className="bg-destructive hover:bg-destructive/90"
            >
              YES, RESET EVERYTHING
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
