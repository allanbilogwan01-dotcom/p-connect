import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, User, Settings, Check, ChevronRight, 
  Shield, Lock, Globe, Calendar, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { setSettings, getSettings, createUser, setPassword, createAuditLog } from '@/lib/localStorage';

interface SetupWizardProps {
  onComplete: () => void;
}

type SetupStep = 'facility' | 'admin' | 'config' | 'complete';

const STEPS: { id: SetupStep; label: string; icon: React.ReactNode }[] = [
  { id: 'facility', label: 'Facility', icon: <Building2 className="w-5 h-5" /> },
  { id: 'admin', label: 'Admin Account', icon: <User className="w-5 h-5" /> },
  { id: 'config', label: 'Configuration', icon: <Settings className="w-5 h-5" /> },
  { id: 'complete', label: 'Complete', icon: <Check className="w-5 h-5" /> },
];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('facility');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Facility data
  const [facilityName, setFacilityName] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [timezone, setTimezone] = useState('Asia/Manila');

  // Admin data
  const [adminUsername, setAdminUsername] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Config data
  const [immediateFamilyLimit, setImmediateFamilyLimit] = useState(-1);
  const [legalGuardianLimit, setLegalGuardianLimit] = useState(2);
  const [closeFriendLimit, setCloseFriendLimit] = useState(3);
  const [dataRetentionDays, setDataRetentionDays] = useState(365);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const validateStep = (): boolean => {
    if (currentStep === 'facility') {
      if (!facilityName.trim()) {
        toast({ title: 'Error', description: 'Facility name is required', variant: 'destructive' });
        return false;
      }
    } else if (currentStep === 'admin') {
      if (!adminUsername.trim() || !adminFullName.trim() || !adminPassword) {
        toast({ title: 'Error', description: 'All admin fields are required', variant: 'destructive' });
        return false;
      }
      if (adminPassword !== confirmPassword) {
        toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
        return false;
      }
      if (adminPassword.length < 8) {
        toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Save settings
      const currentSettings = getSettings();
      setSettings({
        ...currentSettings,
        facility_name: facilityName.toUpperCase(),
        immediate_family_limit: immediateFamilyLimit,
        legal_guardian_limit: legalGuardianLimit,
        close_friend_limit: closeFriendLimit,
        data_retention_days: dataRetentionDays,
      });

      // Create super admin
      const newAdmin = createUser({
        username: adminUsername,
        email: adminEmail || `${adminUsername.toLowerCase()}@facility.local`,
        full_name: adminFullName.toUpperCase(),
        role: 'super_admin',
        status: 'active',
      });

      setPassword(adminUsername, adminPassword);

      // Create audit log
      createAuditLog({
        user_id: newAdmin.id,
        action: 'user_created',
        target_type: 'user',
        target_id: newAdmin.id,
      });

      // Mark setup as complete
      localStorage.setItem('watchguard_setup_complete', 'true');
      localStorage.setItem('watchguard_facility_address', facilityAddress);
      localStorage.setItem('watchguard_timezone', timezone);

      toast({
        title: 'Setup Complete',
        description: 'System has been configured successfully.',
      });

      setCurrentStep('complete');
      
      // Delay before calling onComplete to show success screen
      setTimeout(onComplete, 2000);
    } catch (error) {
      toast({
        title: 'Setup Failed',
        description: 'An error occurred during setup. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl glass-card">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-bold gold-text">WATCHGUARD</h1>
          </div>
          <CardTitle className="text-xl">System Setup Wizard</CardTitle>
          <CardDescription>Configure your facility for first-time use</CardDescription>
        </CardHeader>

        {/* Progress Steps */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index <= currentStepIndex 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : 'border-muted-foreground/30 text-muted-foreground'
                }`}>
                  {index < currentStepIndex ? <Check className="w-5 h-5" /> : step.icon}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-12 sm:w-20 h-0.5 mx-2 transition-colors ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            {STEPS.map((step) => (
              <span key={step.id} className="w-10 text-center">{step.label}</span>
            ))}
          </div>
        </div>

        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Facility */}
            {currentStep === 'facility' && (
              <motion.div
                key="facility"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                  <h2 className="text-lg font-semibold">Facility Information</h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facilityName">Facility Name *</Label>
                  <Input
                    id="facilityName"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder="e.g., CITY JAIL FACILITY"
                    className="input-field uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facilityAddress">Address</Label>
                  <Input
                    id="facilityAddress"
                    value={facilityAddress}
                    onChange={(e) => setFacilityAddress(e.target.value)}
                    placeholder="Complete facility address"
                    className="input-field"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="input-field">
                      <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Manila">Asia/Manila (GMT+8)</SelectItem>
                      <SelectItem value="Asia/Singapore">Asia/Singapore (GMT+8)</SelectItem>
                      <SelectItem value="Asia/Hong_Kong">Asia/Hong Kong (GMT+8)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}

            {/* Step 2: Admin Account */}
            {currentStep === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-6 h-6 text-primary" />
                  <h2 className="text-lg font-semibold">Super Admin Account</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminUsername">Username *</Label>
                    <Input
                      id="adminUsername"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Admin username"
                      className="input-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminFullName">Full Name *</Label>
                    <Input
                      id="adminFullName"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      placeholder="Full name"
                      className="input-field uppercase"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="adminEmail">Email (optional)</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@facility.local"
                      className="input-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Password *</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="input-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                  <Lock className="w-4 h-4 text-warning shrink-0" />
                  <span className="text-warning">Save these credentials securely. They cannot be recovered.</span>
                </div>
              </motion.div>
            )}

            {/* Step 3: Configuration */}
            {currentStep === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-6 h-6 text-primary" />
                  <h2 className="text-lg font-semibold">System Configuration</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Immediate Family Limit</Label>
                    <Select value={String(immediateFamilyLimit)} onValueChange={(v) => setImmediateFamilyLimit(Number(v))}>
                      <SelectTrigger className="input-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">Unlimited</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Max immediate family visitors per PDL</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Legal Guardian Limit</Label>
                    <Select value={String(legalGuardianLimit)} onValueChange={(v) => setLegalGuardianLimit(Number(v))}>
                      <SelectTrigger className="input-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Close Friend Limit</Label>
                    <Select value={String(closeFriendLimit)} onValueChange={(v) => setCloseFriendLimit(Number(v))}>
                      <SelectTrigger className="input-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data Retention</Label>
                    <Select value={String(dataRetentionDays)} onValueChange={(v) => setDataRetentionDays(Number(v))}>
                      <SelectTrigger className="input-field">
                        <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">90 Days</SelectItem>
                        <SelectItem value="180">180 Days</SelectItem>
                        <SelectItem value="365">1 Year</SelectItem>
                        <SelectItem value="730">2 Years</SelectItem>
                        <SelectItem value="-1">Indefinite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Complete */}
            {currentStep === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                  <Check className="w-10 h-10 text-success animate-check-bounce" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Setup Complete!</h2>
                <p className="text-muted-foreground">
                  Your system is now configured and ready to use.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          {currentStep !== 'complete' && (
            <div className="flex justify-between mt-6 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
              >
                Back
              </Button>
              
              {currentStep === 'config' ? (
                <Button
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="btn-scanner"
                >
                  {isSubmitting ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Complete Setup
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext} className="btn-scanner">
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
