'use client';

import React from 'react';
import Link from 'next/link';
import { StatCard } from '@leadloom/ui';
import { Key, FlaskConical, Send, RefreshCw, ChevronRight } from 'lucide-react';

export interface CardState<T = number> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  /** The engine has no endpoint for this yet: show an honest label, never a number. */
  unavailable?: boolean;
}

interface StatCardsGridProps {
  keysState: CardState<number>;
  experimentsState: CardState<number>;
  jobsState: CardState<number>;
  onRetryKeys: () => void;
  onRetryExperiments: () => void;
  onRetryJobs: () => void;
}

function renderValue(state: CardState<number>, onRetry: () => void) {
  if (state.unavailable) {
    return <span className="text-sm font-normal text-text-muted">Not available yet</span>;
  }
  if (state.isLoading) {
    return <div className="h-7 w-12 rounded bg-canvas-elevated animate-pulse my-0.5" />;
  }

  if (state.error) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-signal-failed font-normal">Failed</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRetry();
          }}
          className="inline-flex items-center gap-1 text-xs text-brand-loom hover:underline font-normal cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const val = state.data ?? 0;
  return <span>{val.toLocaleString()}</span>;
}

export function StatCardsGrid({
  keysState,
  experimentsState,
  jobsState,
  onRetryKeys,
  onRetryExperiments,
  onRetryJobs,
}: StatCardsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Provider Keys */}
      <Link
        href="/app/connectors"
        className="block group rounded-xl transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom"
      >
        <StatCard
          label="Connected Providers"
          value={renderValue(keysState, onRetryKeys)}
          hint="Active BYOK credentials"
          icon={
            <div className="flex items-center gap-1.5 text-text-muted group-hover:text-brand-loom transition-colors">
              <Key className="w-4 h-4 text-brand-loom" />
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          }
          className="group-hover:border-border-muted transition-colors cursor-pointer"
        />
      </Link>

      {/* Validator Experiments */}
      <Link
        href="/app/validator"
        className="block group rounded-xl transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom"
      >
        <StatCard
          label="Validator Experiments"
          value={renderValue(experimentsState, onRetryExperiments)}
          hint="Smoke-test landing pages"
          icon={
            <div className="flex items-center gap-1.5 text-text-muted group-hover:text-brand-weave transition-colors">
              <FlaskConical className="w-4 h-4 text-brand-weave" />
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          }
          className="group-hover:border-border-muted transition-colors cursor-pointer"
        />
      </Link>

      {/* Outbound Jobs */}
      <Link
        href="/app/campaigns"
        className="block group rounded-xl transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom"
      >
        <StatCard
          label="Outbound Jobs"
          value={renderValue(jobsState, onRetryJobs)}
          hint="Queued and sent steps"
          icon={
            <div className="flex items-center gap-1.5 text-text-muted group-hover:text-brand-matrix transition-colors">
              <Send className="w-4 h-4 text-brand-matrix" />
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          }
          className="group-hover:border-border-muted transition-colors cursor-pointer"
        />
      </Link>
    </div>
  );
}
