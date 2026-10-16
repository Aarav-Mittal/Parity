'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'money_tracker_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Apply theme to DOM
  const applyTheme = useCallback((targetTheme: Theme) => {
    const root = document.documentElement;
    let effectiveDark = false;

    if (targetTheme === 'dark') {
      effectiveDark = true;
    } else if (targetTheme === 'light') {
      effectiveDark = false;
    } else {
      // System
      effectiveDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (effectiveDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    setIsDark(effectiveDark);
  }, []);

  // Initialize theme from localStorage or system on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initialTheme: Theme = savedTheme && ['light', 'dark', 'system'].includes(savedTheme)
        ? savedTheme
        : 'system';

      setThemeState(initialTheme);
      applyTheme(initialTheme);
    } catch {
      applyTheme('system');
    }
  }, [applyTheme]);

  // Listen to system preference changes when in 'system' mode
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mounted, theme, applyTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // LocalStorage access may fail in private mode
    }
    applyTheme(newTheme);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    // If currently dark, switch to light. If light, switch to dark.
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
