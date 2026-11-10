'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface AuthAlertProps {
  type?: 'error' | 'success' | 'info';
  message: string | null | undefined;
  className?: string;
}

export function AuthAlert({ type = 'error', message, className = '' }: AuthAlertProps) {
  if (!message) return null;

  if (type === 'error') {
    return (
      <div
        className={`p-3 rounded-lg bg-signal-failed/10 border border-signal-failed/30 text-signal-failed text-xs flex items-start gap-2 leading-relaxed ${className}`}
        role="alert"
      >
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span className="flex-1">{message}</span>
      </div>
    );
  }

  if (type === 'success') {
    return (
      <div
        className={`p-3 rounded-lg bg-signal-verified/10 border border-signal-verified/30 text-signal-verified text-xs flex items-start gap-2 leading-relaxed ${className}`}
        role="status"
      >
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
        <span className="flex-1">{message}</span>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-lg bg-brand-loom/10 border border-brand-loom/30 text-text-primary text-xs flex items-start gap-2 leading-relaxed ${className}`}
      role="status"
    >
      <Info className="w-4 h-4 shrink-0 text-brand-loom mt-0.5" />
      <span className="flex-1">{message}</span>
    </div>
  );
}
