import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, ShieldX } from 'lucide-react';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { Badge, Button } from '@leadloom/ui';
import { auth } from '../../auth';
import { isPlatformAdmin } from '../../lib/platform-admin';
import { AdminNav } from './admin-nav';
import {engineCall,mintBridgeToken} from '../../lib/engine-server';

/**
 * Strict server-side platform operator layout.
 * Evaluates session and provider verification BEFORE rendering children.
 * Fails closed server-side, preventing unverified accounts from ever receiving admin HTML/data.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user=session?.user as {email?:string|null;email_verified?:boolean;idp?:string;authTime?:number}|undefined;
  let authorized=false,unavailable=false;
  if(isPlatformAdmin(user)){
    const token=mintBridgeToken(user!);
    if(token){try{const checked=await engineCall('/admin/verify',{headers:{Authorization:'Bearer '+token}});authorized=checked.ok;unavailable=checked.status>=500;}catch{unavailable=true;}}
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-signal-failed/10 border border-signal-failed/30 flex items-center justify-center text-signal-failed mb-4">
          <ShieldX className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-text-primary tracking-tight mb-1">
          {unavailable?'Platform operator access unavailable':'Access Denied: Platform Admin Restricted'}
        </h1>
        <p className="text-xs text-text-muted max-w-md mb-6 leading-relaxed">
          {unavailable?'Current operator identity could not be confirmed. No platform data was loaded.':'The Platform Operator Console is restricted to the designated provider-verified administrator and current active account access.'}
        </p>
        <Link href="/app">
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
          <span className="hidden sm:inline text-text-muted">Verified operator, read-only overview</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="subtle" className="text-[10px] uppercase font-mono">
            Read-only
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

          <AdminNav />
        </div>
      </header>

      {/* Content Canvas */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {children}
      </main>
    </div>
  );
}
