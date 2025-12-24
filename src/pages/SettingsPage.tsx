import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, Save, RotateCcw, Building, Users, Scan, 
  Database, Shield, AlertTriangle, Cloud, ExternalLink, Info
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
import { getSettings, setSettings, resetStorage, createAuditLog } from '@/lib/localStorage';
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
  const [cloudProvider, setCloudProvider] = useState<string>('none');
  const [cloudConnected, setCloudConnected] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleCloudConnect = () => {
    if (cloudProvider === 'none') {
      toast({
        title: 'Select Provider',
        description: 'Please select a cloud provider first.',
        variant: 'destructive',
      });
      return;
    }
    
    // Simulate connection - in real app this would authenticate with the provider
    toast({
      title: 'Cloud Connection',
      description: `Connecting to ${cloudProvider}... This feature requires backend integration.`,
    });
    setCloudConnected(true);
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
    toast({ title: 'Settings Saved', description: 'System settings have been updated.' });
  };

  const handleReset = () => {
    resetStorage();
    toast({ 
      title: 'System Reset', 
      description: 'All data has been cleared. Page will reload.',
      variant: 'destructive',
    });
    setTimeout(() => window.location.reload(), 1500);
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
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system behavior and preferences
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} className="btn-scanner">
            <Save className="w-5 h-5 mr-2" />
            Save Changes
          </Button>
        )}
      </div>

      {/* Facility Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Facility Information
          </CardTitle>
          <CardDescription>Basic facility details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Facility Name</Label>
            <Input
              value={settings.facility_name}
              onChange={(e) => updateSetting('facility_name', e.target.value)}
              className="input-field max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Visitor Limits */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Visitor Limits
          </CardTitle>
          <CardDescription>Maximum visitors per PDL by category (-1 for unlimited)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Immediate Family</Label>
              <Input
                type="number"
                value={settings.immediate_family_limit}
                onChange={(e) => updateSetting('immediate_family_limit', parseInt(e.target.value))}
                className="input-field"
                min={-1}
              />
              <p className="text-xs text-muted-foreground">-1 = Unlimited</p>
            </div>
            <div className="space-y-2">
              <Label>Legal Guardian</Label>
              <Input
                type="number"
                value={settings.legal_guardian_limit}
                onChange={(e) => updateSetting('legal_guardian_limit', parseInt(e.target.value))}
                className="input-field"
                min={-1}
              />
            </div>
            <div className="space-y-2">
              <Label>Close Friend</Label>
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
            Face Recognition
          </CardTitle>
          <CardDescription>Biometric verification settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recognition Threshold</Label>
                <span className="text-sm font-mono text-primary">{settings.face_recognition_threshold.toFixed(2)}</span>
              </div>
              <Slider
                value={[settings.face_recognition_threshold]}
                onValueChange={([val]) => updateSetting('face_recognition_threshold', val)}
                min={0.5}
                max={0.95}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Higher values = stricter matching. Recommended: 0.70 - 0.85
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Match Margin</Label>
                <span className="text-sm font-mono text-primary">{settings.face_recognition_margin.toFixed(2)}</span>
              </div>
              <Slider
                value={[settings.face_recognition_margin]}
                onValueChange={([val]) => updateSetting('face_recognition_margin', val)}
                min={0.05}
                max={0.3}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Required gap between best and second-best match
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conjugal Visits */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Conjugal Visit Eligibility
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
                <Label className="text-sm cursor-pointer">
                  {RELATIONSHIP_LABELS[rel]}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cloud Sync */}
      <Card className="glass-card border-info/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="w-5 h-5 text-info" />
            Cloud Storage & Sync
            <Badge variant="outline" className="ml-2 text-xs">Beta</Badge>
          </CardTitle>
          <CardDescription>Connect to cloud storage for data backup and multi-device sync</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/30">
            <Info className="w-4 h-4 text-info flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Cloud sync allows you to backup your data and access it from multiple devices. 
              Select your preferred cloud provider below.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cloud Provider</Label>
              <Select value={cloudProvider} onValueChange={setCloudProvider}>
                <SelectTrigger className="input-field">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Local Only)</SelectItem>
                  <SelectItem value="supabase">Supabase</SelectItem>
                  <SelectItem value="firebase">Firebase</SelectItem>
                  <SelectItem value="aws">AWS S3</SelectItem>
                  <SelectItem value="azure">Azure Blob</SelectItem>
                  <SelectItem value="gcp">Google Cloud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end gap-2">
              <Button 
                onClick={handleCloudConnect}
                className={cloudConnected ? 'bg-success hover:bg-success/90' : 'btn-scanner'}
                disabled={cloudProvider === 'none'}
              >
                {cloudConnected ? (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Connected
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {cloudProvider !== 'none' && (
            <p className="text-xs text-muted-foreground">
              Note: Cloud integration requires additional setup. Contact your system administrator for configuration.
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Options */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            System Options
          </CardTitle>
          <CardDescription>General system behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <Label>Allow Guest Enrollment</Label>
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
            <Label>Data Retention (Days)</Label>
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
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div>
              <p className="font-medium text-foreground">Reset All Data</p>
              <p className="text-sm text-muted-foreground">
                Clear all data and reset to factory defaults. This cannot be undone.
              </p>
            </div>
            <Button 
              variant="destructive"
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all users, PDLs, visitors, visit records, and settings.
              Only the default super admin account will remain. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReset}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
