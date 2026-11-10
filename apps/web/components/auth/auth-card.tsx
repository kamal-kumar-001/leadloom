import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md relative z-10">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
          <span className="w-8 h-8 rounded-lg bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-sm text-brand-loom font-bold shadow-glow group-hover:scale-105 transition-transform">
            🧵
          </span>
          <span className="text-xl font-bold tracking-tight text-text-primary">LeadLoom</span>
        </Link>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
      </div>

      <div className="bg-canvas-surface border border-border-subtle rounded-xl p-6 shadow-lg backdrop-blur-md">
        {children}
      </div>

      <div className="flex items-center justify-center gap-2 mt-6 text-xs text-text-muted">
        <ShieldCheck className="w-4 h-4 text-signal-verified" />
        <span>Tenant-isolated workspaces • Bring your own keys</span>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent-loom-glow)_0%,_transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border-subtle)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-subtle)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
      {children}
    </div>
  );
}
