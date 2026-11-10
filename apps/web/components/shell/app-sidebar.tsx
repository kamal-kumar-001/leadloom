'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Table2,
  Plug,
  Mail,
  Send,
  FlaskConical,
  Settings,
  ShieldAlert,
  LogOut,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
} from 'lucide-react';
import { WorkspaceSwitcher } from './workspace-switcher';
import { useShellIdentity } from './identity';
import { Badge } from '@leadloom/ui';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Tables', href: '/app/tables', icon: Table2, badge: '50k virtual' },
  { name: 'Connectors', href: '/app/connectors', icon: Plug, badge: 'BYOK' },
  { name: 'Mailboxes', href: '/app/mailboxes', icon: Mail, badge: 'SPF/DKIM' },
  { name: 'Campaigns', href: '/app/campaigns', icon: Send },
  { name: 'Validator', href: '/app/validator', icon: FlaskConical, badge: 'Smoke' },
  { name: 'Settings & Plans', href: '/app/settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const identity = useShellIdentity();

  return (
    <aside className="w-64 bg-canvas-surface border-r border-border-subtle flex flex-col shrink-0 select-none h-screen">
      {/* Brand Header */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <Link href="/app/tables" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-sm text-brand-loom font-bold shadow-glow group-hover:scale-105 transition-transform">
            🧵
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-text-primary tracking-tight leading-none">LeadLoom</span>
            <span className="text-[10px] text-text-muted font-mono mt-0.5">Signal Engine</span>
          </div>
        </Link>
        <Badge variant="subtle" className="text-[10px] px-1.5 py-0.5 font-mono">
          v1.0
        </Badge>
      </div>

      {/* Workspace Switcher */}
      <div className="p-3 border-b border-border-subtle">
        <WorkspaceSwitcher />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
          Platform Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-brand-loom/15 text-brand-loom border border-brand-loom/30 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-canvas-elevated'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-loom' : 'text-text-muted'}`} />
                <span className="truncate">{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive
                      ? 'bg-brand-loom/25 text-brand-loom'
                      : 'bg-canvas-elevated text-text-muted'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
          Operator Tools
        </div>
        <Link
          href="/admin"
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            pathname.startsWith('/admin')
              ? 'bg-signal-catchall/15 text-signal-catchall border border-signal-catchall/30'
              : 'text-text-secondary hover:text-text-primary hover:bg-canvas-elevated'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-signal-catchall" />
            <span>Platform Admin</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        </Link>
      </nav>

      {/* Footer Profile & Session */}
      <div className="p-3 border-t border-border-subtle bg-canvas-elevated/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-canvas-surface border border-border-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-accent-loom/20 border border-brand-loom/30 flex items-center justify-center text-xs font-bold text-brand-loom">
              {(identity.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text-primary truncate">{identity.email || 'Signed in'}</div>
              <div className="text-[10px] text-text-muted truncate">{identity.role || ''}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded hover:bg-canvas-elevated text-text-muted hover:text-signal-failed transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
