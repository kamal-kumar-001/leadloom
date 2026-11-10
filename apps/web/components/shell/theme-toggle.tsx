'use client';

import React from 'react';
import { useTheme } from '@leadloom/ui';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`p-2 rounded-lg bg-canvas-elevated hover:bg-canvas-subtle border border-border-subtle text-text-secondary hover:text-text-primary transition-all active:scale-[0.96] flex items-center justify-center ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-signal-catchall transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-brand-loom transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}
