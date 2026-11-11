'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { Badge } from '@leadloom/ui';

interface AppTopbarProps {
  onToggleMobileMenu?: () => void;
}

const SAMPLE_ROUTES = ['/app/tables', '/app/connectors', '/app/campaigns', '/app/validator'];

export function AppTopbar({ onToggleMobileMenu }: AppTopbarProps) {
  const pathname = usePathname();

  const getSectionTitle = () => {
    if (pathname.includes('/tables')) return 'Virtual Grid Loom';
    if (pathname.includes('/connectors')) return 'BYOK Enrichment Connectors';
    if (pathname.includes('/mailboxes')) return 'Outbound Mailbox Pool';
    if (pathname.includes('/campaigns')) return 'Multi-Step Sequences';
    if (pathname.includes('/validator')) return 'Idea Smoke-Test Validator';
    if (pathname.includes('/settings')) return 'Settings';
    return 'Dashboard';
  };

  return (
    <header className="h-14 border-b border-border-subtle bg-canvas-surface/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg bg-canvas-elevated border border-border-subtle text-text-secondary"
            aria-label="Open navigation menu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-mono hidden sm:inline">Workspace /</span>
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">{getSectionTitle()}</h2>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Pages that still render fixture data say so. Real pages (overview, settings) show nothing. */}
        {SAMPLE_ROUTES.some((r) => pathname.startsWith(r)) && (
          <Badge variant="matrix" className="text-xs py-1 px-2.5 font-mono">
            Sample data on this page
          </Badge>
        )}

        <div className="h-4 w-px bg-border-subtle mx-1 hidden sm:block" />

        <ThemeToggle />
      </div>
    </header>
  );
}
