import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { CameraProvider } from "@/hooks/useCameraContext";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/components/NotificationCenter";
import { ThemeProvider } from "@/contexts/ThemeContext";
import MainLayout from "@/components/layout/MainLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import PDLMasterlistPage from "@/pages/PDLMasterlistPage";
import VisitorEnrollmentPage from "@/pages/VisitorEnrollmentPage";
import KinDalawPage from "@/pages/KinDalawPage";
import VisitationPage from "@/pages/VisitationPage";
import ReportsPage from "@/pages/ReportsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import UserManagementPage from "@/pages/UserManagementPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import { SetupWizard } from "@/components/SetupWizard";

const queryClient = new QueryClient();

// Check if setup has been completed
function useSetupStatus() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  
  useEffect(() => {
    const setupCompleted = localStorage.getItem('watchguard_setup_complete');
    setIsSetupComplete(setupCompleted === 'true');
  }, []);
  
  const completeSetup = () => {
    setIsSetupComplete(true);
  };
  
  return { isSetupComplete, completeSetup };
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes({ onSetupComplete }: { onSetupComplete: () => void }) {
  const { isAuthenticated } = useAuth();
  const { isSetupComplete, completeSetup } = useSetupStatus();
  
  // Show loading while checking setup status
  if (isSetupComplete === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  // Show setup wizard if not completed
  if (!isSetupComplete) {
    return (
      <SetupWizard onComplete={() => {
        completeSetup();
        onSetupComplete();
      }} />
    );
  }
  
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="pdl" element={<PDLMasterlistPage />} />
        <Route path="visitors" element={<VisitorEnrollmentPage />} />
        <Route path="kin-dalaw" element={<KinDalawPage />} />
        <Route path="visitation" element={<VisitationPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  const [, setRefresh] = useState(0);
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <CameraProvider>
            <NotificationProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AppRoutes onSetupComplete={() => setRefresh(r => r + 1)} />
                </BrowserRouter>
              </TooltipProvider>
            </NotificationProvider>
          </CameraProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
