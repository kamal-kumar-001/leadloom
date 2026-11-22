'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
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
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { BrandMark, Badge } from '@leadloom/ui';
import { WorkspaceSwitcher } from './workspace-switcher';
import { useShellIdentity } from './identity';
import { HelpGuideModal } from './help-guide-modal';
import { SystemDiagnosticsModal } from './system-diagnostics-modal';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Workspace Core',
    items: [
      { name: 'Overview', href: '/app', icon: LayoutDashboard },
      { name: 'Projects & Tokens', href: '/app/projects', icon: FolderGit2 },
      { name: 'Tables', href: '/app/tables', icon: Table2 },
    ],
  },
  {
    group: 'Outbound Engine',
    items: [
      { name: 'Connectors', href: '/app/connectors', icon: Plug },
      { name: 'Mailboxes', href: '/app/mailboxes', icon: Mail },
      { name: 'Campaigns', href: '/app/campaigns', icon: Send },
    ],
  },
  {
    group: 'Signals & Research',
    items: [
      { name: 'Validator', href: '/app/validator', icon: FlaskConical },
      { name: 'Research', href: '/app/research', icon: Globe },
      { name: 'Signals', href: '/app/signals', icon: Radar },
      { name: 'Work history', href: '/app/runs', icon: Activity },
    ],
  },
  {
    group: 'Administration',
    items: [
      { name: 'Settings & Plans', href: '/app/settings', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const identity = useShellIdentity();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDiagOpen, setIsDiagOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('leadloom-sidebar-collapsed') === 'true';
    setCollapsed(saved);
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('leadloom-sidebar-collapsed', String(next));
      return next;
    });
  };

  const displayName = identity.name || (identity.email ? identity.email.split('@')[0] : 'Signed In');
  const initial = (identity.name || identity.email || '?').charAt(0).toUpperCase();

  const formattedRole = identity.isPlatformAdmin
    ? 'Platform Admin'
    : identity.role === 'admin'
    ? 'Admin'
    : identity.role === 'read_only'
    ? 'Read Only'
    : 'Member';

  const renderNavLeaf = (item: NavItem) => {
    const isActive = item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed && mounted ? item.name : undefined}
        className={`flex items-center w-full px-3 py-2 rounded-lg text-xs font-medium transition-all group relative overflow-hidden ${
          isActive
            ? 'bg-brand-loom/15 text-brand-loom border border-brand-loom/30 shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-canvas-elevated'
        }`}
      >
        {/* Glow indicator bar on active route */}
        {isActive && (
          <div className="absolute left-0 w-1 h-5 rounded-r bg-brand-loom shadow-glow" />
        )}

        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-brand-loom' : 'text-text-muted group-hover:text-text-primary'}`} />

        {(!mounted || !collapsed) && (
          <span className="ml-2.5 flex-1 truncate">{item.name}</span>
        )}

        {(!mounted || !collapsed) && item.badge && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
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
  };

  return (
    <>
      <aside
        className={`bg-canvas-surface border-r border-border-subtle flex flex-col shrink-0 select-none h-screen transition-[width] duration-200 ease-in-out ${
          mounted && collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="p-3.5 border-b border-border-subtle flex items-center justify-between h-14 shrink-0">
          <Link href="/app" className="flex items-center gap-2.5 group min-w-0 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-sm text-brand-loom font-bold shadow-glow group-hover:scale-105 transition-transform shrink-0">
              <BrandMark className="h-4 w-4" />
            </div>
            {(!mounted || !collapsed) && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-text-primary tracking-tight leading-none truncate">LeadLoom</span>
                <span className="text-[10px] text-text-muted font-mono mt-0.5 truncate">Signal Engine</span>
              </div>
            )}
          </Link>
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors cursor-pointer shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {mounted && collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Workspace Switcher */}
        {(!mounted || !collapsed) && (
          <div className="p-2.5 border-b border-border-subtle shrink-0">
            <WorkspaceSwitcher />
          </div>
        )}

        {/* Navigation Items (Grouped) */}
        <nav className="flex-1 p-2.5 space-y-3 overflow-y-auto overflow-x-hidden">
          {NAV_GROUPS.map((group) => (
            <div key={group.group} className="space-y-0.5">
              {(!mounted || !collapsed) && (
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  {group.group}
                </div>
              )}
              {group.items.map((item) => renderNavLeaf(item))}
            </div>
          ))}

          {/* Conditional Platform Admin Console (Only visible to verified platform admin) */}
          {identity.isPlatformAdmin && (
            <div className="space-y-0.5 pt-1 border-t border-border-subtle">
              {(!mounted || !collapsed) && (
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-brand-loom font-semibold flex items-center gap-1">
                  <span>Operator</span>
                </div>
              )}
              {renderNavLeaf({
                name: 'Platform Admin',
                href: '/admin',
                icon: Shield,
              })}
            </div>
          )}
        </nav>

        {/* Lower Section: Help & Diagnostics */}
        <div className="p-2 border-t border-border-subtle space-y-1 shrink-0 bg-canvas-elevated/20">
          <button
            onClick={() => setIsHelpOpen(true)}
            className={`flex items-center w-full px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-canvas-elevated transition-colors cursor-pointer ${
              collapsed && mounted ? 'justify-center px-0' : ''
            }`}
            title="Platform Guide & Instructions"
          >
            <HelpCircle className="w-4 h-4 shrink-0 text-text-muted" />
            {(!mounted || !collapsed) && <span className="ml-2.5 truncate">Help Guide</span>}
          </button>
          <button
            onClick={() => setIsDiagOpen(true)}
            className={`flex items-center w-full px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-canvas-elevated transition-colors cursor-pointer ${
              collapsed && mounted ? 'justify-center px-0' : ''
            }`}
            title="System Diagnostics & Health"
          >
            <Activity className="w-4 h-4 shrink-0 text-text-muted" />
            {(!mounted || !collapsed) && <span className="ml-2.5 truncate">Diagnostics</span>}
          </button>
        </div>

        {/* Footer Profile & Session */}
        <div className="p-2.5 border-t border-border-subtle bg-canvas-elevated/40 shrink-0">
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-canvas-surface border border-border-subtle overflow-hidden">
            <Link
              href="/app/settings"
              title="Open Account Settings"
              className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-85 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center text-xs font-bold text-brand-loom shrink-0">
                {initial}
              </div>
              {(!mounted || !collapsed) && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary truncate">{displayName}</div>
                  <div className="text-[10px] text-text-muted font-mono truncate">{formattedRole}</div>
                </div>
              )}
            </Link>
            {(!mounted || !collapsed) && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded hover:bg-canvas-elevated text-text-muted hover:text-signal-failed transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Modals */}
      <HelpGuideModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <SystemDiagnosticsModal isOpen={isDiagOpen} onClose={() => setIsDiagOpen(false)} />
    </>
  );
}
