'use client';

import React from 'react';
import { Card, Badge } from '@leadloom/ui';
import { useTheme } from '@leadloom/ui';
import { Moon, Sun, Check } from 'lucide-react';

export function AppearanceSettingsCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-text-primary tracking-tight">
          Appearance
        </h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Select interface theme for all LeadLoom console views.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-border-subtle pt-4">
        {/* Dark Theme Option */}
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
            theme === 'dark'
              ? 'border-brand-loom bg-canvas-elevated shadow-sm ring-1 ring-brand-loom'
              : 'border-border-subtle bg-canvas-surface hover:bg-canvas-elevated hover:border-border-muted'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center text-brand-loom">
                <Moon className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Dark Theme</span>
            </div>
            {theme === 'dark' ? (
              <Badge variant="loom" className="text-[10px] py-0 px-1.5 font-mono">
                <Check className="w-3 h-3 mr-1 stroke-[3]" /> Active
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Dark obsidian canvas with subtle borders and illuminated brand accents.
          </p>
        </button>

        {/* Light Theme Option */}
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
            theme === 'light'
              ? 'border-brand-loom bg-canvas-elevated shadow-sm ring-1 ring-brand-loom'
              : 'border-border-subtle bg-canvas-surface hover:bg-canvas-elevated hover:border-border-muted'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-signal-catchall/20 border border-signal-catchall/30 flex items-center justify-center text-signal-catchall">
                <Sun className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Light Theme</span>
            </div>
            {theme === 'light' ? (
              <Badge variant="loom" className="text-[10px] py-0 px-1.5 font-mono">
                <Check className="w-3 h-3 mr-1 stroke-[3]" /> Active
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            High-contrast crisp white and slate surfaces optimized for daylight readability.
          </p>
        </button>
      </div>
    </Card>
  );
}
