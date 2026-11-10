import React from 'react';
import { cn } from './utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'verified' | 'catchall' | 'failed' | 'loom' | 'matrix' | 'muted' | 'subtle';
  children: React.ReactNode;
}

export function Badge({ className, variant = 'muted', children, ...props }: BadgeProps) {
  const variants = {
    verified: 'bg-signal-verified/10 text-signal-verified border-signal-verified/30',
    catchall: 'bg-signal-catchall/10 text-signal-catchall border-signal-catchall/30',
    failed: 'bg-signal-failed/10 text-signal-failed border-signal-failed/30',
    loom: 'bg-brand-loom/10 text-brand-loom border-brand-loom/30',
    matrix: 'bg-brand-matrix/10 text-brand-matrix border-brand-matrix/30 font-mono',
    muted: 'bg-canvas-elevated text-text-muted border-border-subtle',
    subtle: 'bg-canvas-elevated text-text-muted border-border-subtle',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border select-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
