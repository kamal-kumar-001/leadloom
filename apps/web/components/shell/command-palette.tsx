'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Table2,
  LayoutDashboard,
  Plug,
  Mail,
  Send,
  FlaskConical,
  Globe,
  Radar,
  Activity,
  FolderGit2,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useShellIdentity } from './identity';

export interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  shortcut?: string;
  icon: React.ElementType;
  action: () => void;
  adminOnly?: boolean;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const identity = useShellIdentity();

  const commandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: 'overview',
        title: 'Workspace Overview',
        subtitle: 'Main health & summary metrics',
        shortcut: '⌥O',
        icon: LayoutDashboard,
        action: () => router.push('/app'),
      },
      {
        id: 'projects',
        title: 'Projects & Tokens',
        subtitle: 'Workspace-scoped credentials & agent tokens',
        shortcut: '⌥P',
        icon: FolderGit2,
        action: () => router.push('/app/projects'),
      },
      {
        id: 'tables',
        title: 'Virtual Grid Tables',
        subtitle: 'High-density prospect data loom',
        shortcut: '⌥T',
        icon: Table2,
        action: () => router.push('/app/tables'),
      },
      {
        id: 'campaigns',
        title: 'Outbound Sequences',
        subtitle: 'Choreographed multi-step cold outreach',
        shortcut: '⌥S',
        icon: Send,
        action: () => router.push('/app/campaigns'),
      },
      {
        id: 'connectors',
        title: 'BYOK Connectors',
        subtitle: 'AES-256 encrypted provider vault',
        shortcut: '⌥C',
        icon: Plug,
        action: () => router.push('/app/connectors'),
      },
      {
        id: 'mailboxes',
        title: 'Mailbox Pool',
        subtitle: 'SPF / DKIM / DMARC deliverability',
        shortcut: '⌥M',
        icon: Mail,
        action: () => router.push('/app/mailboxes'),
      },
      {
        id: 'validator',
        title: 'Idea Validator',
        subtitle: 'Hypothesis smoke-test micro-pages',
        shortcut: '⌥V',
        icon: FlaskConical,
        action: () => router.push('/app/validator'),
      },
      {
        id: 'research',
        title: 'Website Research',
        subtitle: 'Buyer discovery heuristics from domains',
        shortcut: '⌥R',
        icon: Globe,
        action: () => router.push('/app/research'),
      },
      {
        id: 'signals',
        title: 'Signal Discovery Inbox',
        subtitle: 'Real-time hiring & tech stack intents',
        shortcut: '⌥I',
        icon: Radar,
        action: () => router.push('/app/signals'),
      },
      {
        id: 'runs',
        title: 'Project work history',
        subtitle: 'Saved decisions, progress and research by project',
        shortcut: '⌥U',
        icon: Activity,
        action: () => router.push('/app/runs'),
      },
      {
        id: 'settings',
        title: 'Workspace Settings',
        subtitle: 'Account profile, team seats & limits',
        shortcut: '⌥G',
        icon: Settings,
        action: () => router.push('/app/settings'),
      },
    ];

    if (identity.isPlatformAdmin) {
      items.push({
        id: 'admin',
        title: 'Platform Operator Console',
        subtitle: 'Platform-level tenant orchestration',
        shortcut: '⌥A',
        icon: Shield,
        action: () => router.push('/admin'),
        adminOnly: true,
      });
    }

    return items;
  }, [router, identity.isPlatformAdmin]);

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return commandItems;
    const q = search.toLowerCase();
    return commandItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );
  }, [commandItems, search]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // Keyboard navigation inside open palette
  useEffect(() => {
    if (!open) return;
    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[activeIndex]) {
          filteredItems[activeIndex].action();
          setOpen(false);
          setSearch('');
        }
      }
    };
    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [open, filteredItems, activeIndex]);

  const handleSelect = (action: () => void) => {
    action();
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 bg-canvas-elevated border border-border-subtle hover:border-border-muted rounded-lg text-xs text-text-muted hover:text-text-primary transition-all text-left shadow-xs cursor-pointer select-none"
        aria-label="Search workspace commands"
      >
        <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
        <span className="flex-1 truncate">Search workspace…</span>
        <kbd className="hidden sm:inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border-subtle bg-canvas-surface px-1 font-mono text-[9px] font-medium text-text-muted">
          <span>⌘</span>K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Workspace Command Palette"
            className="relative w-full max-w-lg rounded-xl border border-border-subtle bg-canvas-surface shadow-2xl overflow-hidden font-sans z-10 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center border-b border-border-subtle px-3 py-2.5 bg-canvas-elevated/50">
              <Search className="h-4 w-4 text-text-muted mr-2 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a destination or feature…"
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none font-sans"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="p-1 text-text-muted hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">
                  No matching workspace destinations found.
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.action)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-brand-loom/15 text-brand-loom font-medium'
                          : 'text-text-secondary hover:text-text-primary hover:bg-canvas-elevated'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-brand-loom' : 'text-text-muted'}`} />
                        <div className="truncate">
                          <span className="text-text-primary font-medium">{item.title}</span>
                          <span className="ml-2 text-[10px] text-text-muted hidden sm:inline">
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-flex text-[9px] font-mono border border-border-subtle bg-canvas-surface px-1 rounded text-text-muted">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-border-subtle px-3 py-1.5 bg-canvas-elevated/30 flex items-center justify-between text-[10px] text-text-muted font-mono select-none">
              <span>↑↓ to navigate</span>
              <span>↵ to open</span>
              <span>esc to dismiss</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
