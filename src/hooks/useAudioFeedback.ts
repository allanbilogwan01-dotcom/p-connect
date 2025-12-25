import { useCallback, useRef } from 'react';

// Audio context for generating beep sounds
const createBeepSound = (frequency: number, duration: number, type: 'success' | 'error' = 'success') => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = type === 'success' ? 'sine' : 'square';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  // Fade in/out for smoother sound
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);

  // Cleanup
  setTimeout(() => {
    audioContext.close();
  }, duration * 1000 + 100);
};

export function useAudioFeedback() {
  const lastPlayedRef = useRef<number>(0);

  const playSuccessBeep = useCallback(() => {
    // Debounce to prevent multiple rapid plays
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) return;
    lastPlayedRef.current = now;

    // Two-tone success beep (ascending)
    createBeepSound(800, 0.1, 'success');
    setTimeout(() => createBeepSound(1200, 0.15, 'success'), 100);
  }, []);

  const playErrorBeep = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) return;
    lastPlayedRef.current = now;

    // Lower tone for error
    createBeepSound(300, 0.2, 'error');
  }, []);

  const playQRSuccessBeep = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) return;
    lastPlayedRef.current = now;

    // Quick ascending triple beep for QR scan
    createBeepSound(600, 0.08, 'success');
    setTimeout(() => createBeepSound(900, 0.08, 'success'), 80);
    setTimeout(() => createBeepSound(1200, 0.12, 'success'), 160);
  }, []);

  const playFaceMatchBeep = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) return;
    lastPlayedRef.current = now;

    // Smooth confirmation tone for face match
    createBeepSound(880, 0.15, 'success');
    setTimeout(() => createBeepSound(1100, 0.2, 'success'), 150);
  }, []);

  return {
    playSuccessBeep,
    playErrorBeep,
    playQRSuccessBeep,
    playFaceMatchBeep,
  };
}
