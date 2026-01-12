import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

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

// Track active streams globally for accurate favicon
let globalActiveStreams = 0;

function updateFavicon(isActive: boolean) {
  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (link) {
    if (isActive && globalActiveStreams > 0) {
      link.href = '/camera-active.svg';
      document.title = '📹 WATCHGUARD - CAMERA ACTIVE';
    } else {
      link.href = '/watchguard-icon.svg';
      document.title = 'WATCHGUARD - JAIL VISITOR MANAGEMENT';
    }
  }
}

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const isActive = activeCount > 0;

  const incrementActive = useCallback(() => {
    setActiveCount(prev => {
      const next = prev + 1;
      globalActiveStreams = next;
      updateFavicon(next > 0);
      return next;
    });
  }, []);

  const decrementActive = useCallback(() => {
    setActiveCount(prev => {
      const next = Math.max(0, prev - 1);
      globalActiveStreams = next;
      updateFavicon(next > 0);
      return next;
    });
  }, []);

  const setActive = useCallback((active: boolean) => {
    if (active) {
      incrementActive();
    } else {
      decrementActive();
    }
  }, [incrementActive, decrementActive]);

  // Reset favicon on unmount
  useEffect(() => {
    return () => {
      globalActiveStreams = 0;
      updateFavicon(false);
    };
  }, []);

  const value = useMemo(() => ({ 
    isActive, 
    setActive, 
    activeCount, 
    incrementActive, 
    decrementActive,
    selectedDeviceId,
    setSelectedDeviceId
  }), [isActive, setActive, activeCount, incrementActive, decrementActive, selectedDeviceId]);

  return (
    <CameraContext.Provider value={value}>
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
