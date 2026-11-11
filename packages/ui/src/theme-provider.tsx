'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'leadloom_theme';

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      // A route segment (e.g. the light-by-default landing) can lock the DOM
      // theme; while locked, the stored preference is left untouched.
      if (document.documentElement.getAttribute('data-theme-lock')) {
        setMounted(true);
        return;
      }
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
        document.documentElement.setAttribute('data-theme', stored);
        if (stored === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        document.documentElement.setAttribute('data-theme', defaultTheme);
        if (defaultTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch {
      // Fallback for environments where localStorage is blocked
      document.documentElement.setAttribute('data-theme', defaultTheme);
    }
    setMounted(true);
  }, [defaultTheme]);

  // When a route-level theme lock releases (e.g. leaving the light-by-default
  // landing), the route restores the stored theme in the DOM and fires this
  // event; sync provider state so the next toggle behaves correctly. This
  // never writes storage - the landing's light override is not persisted.
  useEffect(() => {
    const sync = () => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') setThemeState(stored);
      } catch {}
    };
    window.addEventListener('leadloom-theme-sync', sync);
    return () => window.removeEventListener('leadloom-theme-sync', sync);
  }, []);

  // Mirrors the resolved provider theme for observability and pixel tests.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme-state', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // Ignore localStorage errors
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'dark',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
