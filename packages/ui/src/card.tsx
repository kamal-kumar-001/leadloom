import React from 'react';
import { cn } from './utils';

/** Surface container. Colors come only from design tokens. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border-subtle bg-canvas-surface', className)} {...props} />;
}

export interface StatCardProps {
  label: string;
  /** Real value from the engine, or null while loading or unavailable. Never a made-up number. */
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold text-text-primary">{value ?? '-'}</div>
      {hint ? <div className="mt-1 text-xs text-text-muted">{hint}</div> : null}
    </Card>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Honest empty state: use instead of placeholder rows or fake data. */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <Card className={cn('flex flex-col items-center text-center px-6 py-10 border-dashed', className)}>
      {icon ? <div className="mb-3 text-text-muted">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-xs text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}
