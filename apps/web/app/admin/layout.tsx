'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, ShieldAlert, ArrowLeft, Database, Users, Activity, FileText } from 'lucide-react';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { Badge } from '@leadloom/ui';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-canvas font-sans">
      {/* High-visibility Platform Operator Banner */}
      <div className="bg-signal-catchall/15 border-b border-signal-catchall/30 px-4 py-2 flex items-center justify-between text-xs text-signal-catchall font-mono select-none">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-signal-catchall animate-pulse" />
          <span className="font-semibold">PLATFORM OPERATOR CONSOLE</span>
          <span className="hidden sm:inline text-text-muted">• Cross-tenant administration & audit logs</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="subtle" className="text-[10px] uppercase font-mono">
            Role: platform_admin
          </Badge>
          <ThemeToggle />
        </div>
      </div>

      {/* Admin Subheader & Navigation */}
      <header className="h-14 border-b border-border-subtle bg-canvas-surface px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <Link
            href="/app/tables"
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Workspace</span>
          </Link>

          <div className="h-4 w-px bg-border-subtle" />

          <nav className="flex items-center gap-4 text-xs font-medium">
            <Link
              href="/admin"
              className={`transition-colors py-1 ${
                pathname === '/admin' ? 'text-brand-loom font-semibold border-b-2 border-brand-loom' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Tenants & Workspaces
            </Link>
            <Link
              href="/admin#plans"
              className="text-text-secondary hover:text-text-primary transition-colors py-1"
            >
              Plans & Entitlements
            </Link>
            <Link
              href="/admin#audit"
              className="text-text-secondary hover:text-text-primary transition-colors py-1"
            >
              Global Audit Log
            </Link>
          </nav>
        </div>

        <Badge variant="matrix" className="text-xs font-mono">
          Demo data • Platform Mock
        </Badge>
      </header>

      {/* Admin Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
