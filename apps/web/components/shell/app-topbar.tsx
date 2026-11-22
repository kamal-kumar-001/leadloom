'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { CommandPalette } from './command-palette';
import { NotificationCenter } from './notification-center';

interface AppTopbarProps {
  onToggleMobileMenu?: () => void;
}


export function AppTopbar({ onToggleMobileMenu }: AppTopbarProps) {
  const pathname = usePathname();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const getSectionTitle = () => {
    if (pathname.includes('/projects')) return 'Projects & Tokens';
    if (pathname.includes('/tables')) return 'Virtual Grid Loom';
    if (pathname.includes('/connectors')) return 'BYOK Enrichment Connectors';
    if (pathname.includes('/mailboxes')) return 'Outbound Mailbox Pool';
    if (pathname.includes('/campaigns')) return 'Multi-Step Sequences';
    if (pathname.includes('/validator')) return 'Idea Smoke-Test Validator';
    if (pathname.includes('/research')) return 'Website Buyer Discovery';
    if (pathname.includes('/signals')) return 'Signal Discovery Inbox';
    if (pathname.includes('/runs')) return 'Project work history';
    if (pathname.includes('/settings')) return 'Workspace Settings';
    return 'Workspace Overview';
  };

  return (
    <>
      <header className="h-14 border-b border-border-subtle bg-canvas-surface/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none z-30">
        {/* Left side mobile menu trigger & breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-1.5 rounded-lg bg-canvas-elevated border border-border-subtle text-text-secondary hover:text-text-primary"
              aria-label="Open navigation menu"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-text-muted font-mono hidden sm:inline">Workspace /</span>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight truncate">{getSectionTitle()}</h2>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Quick command search trigger */}
          <div className="w-32 sm:w-48 md:w-56">
            <CommandPalette />
          </div>

          {/* Notifications Bell */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="p-1.5 rounded-lg border border-border-subtle bg-canvas-elevated hover:bg-canvas-subtle text-text-muted hover:text-text-primary transition-colors cursor-pointer relative"
            aria-label="Open notifications"
            title="Stored campaign attention"
          >
            <Bell className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-border-subtle mx-0.5 hidden sm:block" />

          {/* Dark / Light Theme Toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Top-Right Notification Center */}
      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </>
  );
}
