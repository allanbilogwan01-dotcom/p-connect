import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface CameraContextValue {
  isActive: boolean;
  setActive: (active: boolean) => void;
  activeCount: number;
  incrementActive: () => void;
  decrementActive: () => void;
  selectedDeviceId: string;
  setSelectedDeviceId: (deviceId: string) => void;
}

const CameraContext = createContext<CameraContextValue | null>(null);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const isActive = activeCount > 0;

  const incrementActive = useCallback(() => {
    setActiveCount(prev => prev + 1);
  }, []);

  const decrementActive = useCallback(() => {
    setActiveCount(prev => Math.max(0, prev - 1));
  }, []);

  const setActive = useCallback((active: boolean) => {
    if (active) {
      incrementActive();
    } else {
      decrementActive();
    }
  }, [incrementActive, decrementActive]);

  // Update favicon based on camera state - only show indicator when camera is actually active
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) {
      if (isActive) {
        // Camera is active - show camera indicator in favicon
        link.href = '/camera-active.svg';
        document.title = '📹 WATCHGUARD - CAMERA ACTIVE';
      } else {
        // Camera is not active - show normal favicon
        link.href = '/watchguard-icon.svg';
        document.title = 'WATCHGUARD - JAIL VISITOR MANAGEMENT';
      }
    }
  }, [isActive]);

  return (
    <CameraContext.Provider value={{ 
      isActive, 
      setActive, 
      activeCount, 
      incrementActive, 
      decrementActive,
      selectedDeviceId,
      setSelectedDeviceId
    }}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCameraContext() {
  const context = useContext(CameraContext);
  if (!context) {
    // Return safe defaults when used outside provider
    return {
      isActive: false,
      setActive: () => {},
      activeCount: 0,
      incrementActive: () => {},
      decrementActive: () => {},
      selectedDeviceId: '',
      setSelectedDeviceId: () => {},
    };
  }
  return context;
}
