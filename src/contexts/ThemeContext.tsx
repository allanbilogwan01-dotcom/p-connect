import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeType = 
  | 'dark' 
  | 'royal-dark' 
  | 'royal-gold' 
  | 'royal-purple' 
  | 'royal-silver' 
  | 'government-blue';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  themes: { value: ThemeType; label: string; description: string }[];
}

const themes: { value: ThemeType; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Default dark theme' },
  { value: 'royal-dark', label: 'Royal Dark', description: 'Elegant dark with royal accents' },
  { value: 'royal-gold', label: 'Royal Gold', description: 'Luxurious gold theme' },
  { value: 'royal-purple', label: 'Royal Purple', description: 'Majestic purple theme' },
  { value: 'royal-silver', label: 'Royal Silver', description: 'Refined silver theme' },
  { value: 'government-blue', label: 'Government Blue', description: 'Official light theme' },
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'watchguard-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && themes.some(t => t.value === stored)) {
        return stored as ThemeType;
      }
    }
    return 'dark';
  });

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    themes.forEach(t => root.classList.remove(t.value));
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Handle light/dark mode for system
    if (theme === 'government-blue') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
