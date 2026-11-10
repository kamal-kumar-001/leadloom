'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button, Badge } from '@leadloom/ui';
import { Mail, Lock, Building, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn('credentials', {
        email: email || 'demo@leadloom.dev',
        password: password || 'demopassword123',
        redirect: false,
      });

      if (res?.error) {
        setError('Failed to initialize workspace account.');
        setLoading(false);
      } else {
        router.push('/app/tables');
      }
    } catch {
      setError('An error occurred during account registration.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent-loom-glow)_0%,_transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border-subtle)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-subtle)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <span className="w-8 h-8 rounded-lg bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-sm text-brand-loom font-bold shadow-glow group-hover:scale-105 transition-transform">
              🧵
            </span>
            <span className="text-xl font-bold tracking-tight text-text-primary">LeadLoom</span>
          </Link>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Create your GTM workspace</h1>
          <p className="text-sm text-text-secondary mt-1">Start weaving buyer intent signals with zero per-credit markups</p>
        </div>

        <div className="bg-canvas-surface border border-border-subtle rounded-xl p-6 shadow-lg backdrop-blur-md">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-signal-failed/10 border border-signal-failed/30 text-signal-failed text-xs flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5" htmlFor="workspace">
                Organization / Workspace Name
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="workspace"
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Acme Growth Labs"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5" htmlFor="email">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@acme.com"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-canvas-elevated/60 border border-border-subtle space-y-1.5 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-signal-verified shrink-0" />
                <span>Self-hosted or cloud managed instance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-signal-verified shrink-0" />
                <span>Bring Your Own Key (BYOK) raw vendor rates</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-signal-verified shrink-0" />
                <span>AES-256-GCM encrypted credential vault</span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full justify-center py-2.5 text-sm font-medium mt-2 shadow-sm"
            >
              {loading ? 'Creating Workspace...' : 'Create Workspace'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
            <span>Already have an account?</span>
            <Link href="/login" className="text-brand-loom font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Badge variant="subtle" className="font-mono text-[11px] px-2.5 py-1">
            <ShieldCheck className="w-3 h-3 mr-1 text-signal-verified" />
            Zero-Trust Tenant Boundaries
          </Badge>
        </div>
      </div>
    </div>
  );
}
