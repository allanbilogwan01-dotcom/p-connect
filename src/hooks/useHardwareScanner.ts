import { useState, useEffect, useCallback, useRef } from 'react';

interface UseHardwareScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxLength?: number;
  timeout?: number;
}

export function useHardwareScanner({
  onScan,
  enabled = true,
  minLength = 8,
  maxLength = 20,
  timeout = 100,
}: UseHardwareScannerOptions) {
  const [isListening, setIsListening] = useState(false);
  const bufferRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef(0);

  const processBuffer = useCallback(() => {
    const code = bufferRef.current.trim();
    if (code.length >= minLength && code.length <= maxLength) {
      // Validate it looks like a visitor code (numeric only)
      if (/^\d+$/.test(code)) {
        onScan(code);
      }
    }
    bufferRef.current = '';
  }, [onScan, minLength, maxLength]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    
    // Ignore if focus is on an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;
    
    // If too much time has passed, start fresh
    if (timeSinceLastKey > 500) {
      bufferRef.current = '';
    }
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Handle Enter key - process buffer
    if (e.key === 'Enter') {
      e.preventDefault();
      processBuffer();
      return;
    }
    
    // Only accept numeric and alphanumeric characters
    if (e.key.length === 1 && /^[0-9a-zA-Z]$/.test(e.key)) {
      bufferRef.current += e.key;
      
      // Set timeout to process buffer after no more keys
      timeoutRef.current = setTimeout(() => {
        processBuffer();
      }, timeout);
    }
  }, [enabled, timeout, processBuffer]);

  useEffect(() => {
    if (enabled) {
      setIsListening(true);
      window.addEventListener('keydown', handleKeyDown);
    } else {
      setIsListening(false);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleKeyDown]);

  return { isListening };
}
