'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, ArrowLeft, ShieldX } from 'lucide-react';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { Badge, Button } from '@leadloom/ui';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Platform admin table does not exist in the engine yet.
  // Gated strictly closed (deny) outside explicit dev flag.
  const isDevAdmin = process.env.NEXT_PUBLIC_DEV_ADMIN_ENABLED === 'true' && process.env.NODE_ENV !== 'production';

  if (!isDevAdmin) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-signal-failed/10 border border-signal-failed/30 flex items-center justify-center text-signal-failed mb-4">
          <ShieldX className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-text-primary tracking-tight mb-1">
          Access Denied: Platform Admin Gated
        </h1>
        <p className="text-xs text-text-muted max-w-md mb-6 leading-relaxed">
          The Platform Operator Console is strictly closed. Privileges are decided by the engine from its own database tables; platform administration tables are not yet mounted.
        </p>
        <Link href="/app/tables">
          <Button size="sm" variant="outline" className="text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Workspace</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas font-sans">
      {/* High-visibility Platform Operator Banner */}
      <div className="bg-signal-catchall/15 border-b border-signal-catchall/30 px-4 py-2 flex items-center justify-between text-xs text-signal-catchall font-mono select-none">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-signal-catchall animate-pulse" />
          <span className="font-semibold">PLATFORM OPERATOR CONSOLE</span>
          <span className="hidden sm:inline text-text-muted">• Local dev mode only</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="subtle" className="text-[10px] uppercase font-mono">
            Dev Override Active
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
              System Audit Logs
            </Link>
          </nav>
        </div>
      </header>

      {/* Content Canvas */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {children}
      </main>
    </div>
  );
}
