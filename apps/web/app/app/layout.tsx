'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '../../components/shell/app-sidebar';
import { AppTopbar } from '../../components/shell/app-topbar';
import { fetchAuthMe, provisionWorkspace } from '../../lib/engine-client';
import { Badge, Button } from '@leadloom/ui';
import { ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [engineState, setEngineState] = useState<{
    status: 'checking' | 'verified' | 'provisioning' | 'error';
    error?: string;
  }>({ status: 'checking' });

  useEffect(() => {
    let mounted = true;
    // Fail closed: the app renders only after the engine itself returned a userId for this session.
    async function checkEngineIdentity() {
      try {
        let me = await fetchAuthMe();
        if (!mounted) return;
        if (me.data?.userId) {
          setEngineState({ status: 'verified' });
          return;
        }

        if (me.status === 401) {
          // Signed in on the web but unknown to the engine: first sign-in provisions a workspace.
          setEngineState({ status: 'provisioning' });
          const prov = await provisionWorkspace();
          if (!mounted) return;
          if (prov.status === 'rate_limited') {
            setEngineState({
              status: 'error',
              error: 'Sign-up rate limit reached. Please try again later.',
            });
            return;
          }
          // Whatever provisioning said, trust only a fresh answer from the engine.
          me = await fetchAuthMe();
          if (!mounted) return;
          if (me.data?.userId) {
            setEngineState({ status: 'verified' });
            return;
          }
          setEngineState({
            status: 'error',
            error: prov.error || 'Your session could not be verified. Please sign in again.',
          });
          return;
        }

        setEngineState({
          status: 'error',
          error: me.error || 'The service is unavailable right now. Please retry.',
        });
      } catch {
        if (mounted) {
          setEngineState({ status: 'error', error: 'The service is unavailable right now. Please retry.' });
        }
      }
    }

    checkEngineIdentity();
    return () => {
      mounted = false;
    };
  }, []);

  if (engineState.status === 'error') {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-signal-failed/10 border border-signal-failed/30 flex items-center justify-center text-signal-failed mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-text-primary tracking-tight mb-1">
          Engine Provisioning Notice
        </h1>
        <p className="text-xs text-text-muted max-w-md mb-6 leading-relaxed">
          {engineState.error}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.reload()}
          className="text-xs gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </Button>
      </div>
    );
  }

  if (engineState.status !== 'verified') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center font-sans text-xs text-text-muted">
        {engineState.status === 'provisioning' ? 'Setting up your workspace…' : 'Verifying your session…'}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-canvas overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10">
            <AppSidebar />
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppTopbar onToggleMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto bg-canvas relative">
          {children}
        </main>
      </div>
    </div>
  );
}
