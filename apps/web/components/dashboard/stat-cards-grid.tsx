'use client';

import React from 'react';
import Link from 'next/link';
import { StatCard } from '@leadloom/ui';
import {
  Layers,
  Mail,
  Send,
  ShieldAlert,
  FlaskConical,
  Key,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import type { WorkspaceSummary } from '../../lib/engine-client';

export interface CardState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface StatCardsGridProps {
  summaryState: CardState<WorkspaceSummary>;
  onRetry: () => void;
}

function renderValue(
  state: CardState<WorkspaceSummary>,
  field: keyof WorkspaceSummary,
  onRetry: () => void
) {
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

  const val = state.data ? state.data[field] : 0;
  return <span>{val.toLocaleString()}</span>;
}

export function StatCardsGrid({ summaryState, onRetry }: StatCardsGridProps) {
  const summary = summaryState.data;

  const cards: {
    key: keyof WorkspaceSummary;
    label: string;
    hint: string;
    emptyHint: string;
    href: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'tables',
      label: 'Tables',
      hint: 'Persisted lead tables',
      emptyHint: '0 • No tables created yet',
      href: '/app/tables',
      icon: <Layers className="w-4 h-4 text-brand-loom" />,
    },
    {
      key: 'mailboxes',
      label: 'Outbound Mailboxes',
      hint: 'Active sender pool',
      emptyHint: '0 • No mailboxes added yet',
      href: '/app/mailboxes',
      icon: <Mail className="w-4 h-4 text-signal-verified" />,
    },
    {
      key: 'campaigns',
      label: 'Outbound Campaigns',
      hint: 'Outbound sequences',
      emptyHint: '0 • No campaigns created',
      href: '/app/campaigns',
      icon: <Send className="w-4 h-4 text-brand-matrix" />,
    },
    {
      key: 'suppressions',
      label: 'Suppressed Contacts',
      hint: 'Suppressed recipient emails',
      emptyHint: '0 • No suppressions recorded',
      href: '/app/mailboxes',
      icon: <ShieldAlert className="w-4 h-4 text-text-muted" />,
    },
    {
      key: 'experiments',
      label: 'Validator Experiments',
      hint: 'Smoke-test landing pages',
      emptyHint: '0 • No experiments created',
      href: '/app/validator',
      icon: <FlaskConical className="w-4 h-4 text-brand-weave" />,
    },
    {
      key: 'providerKeys',
      label: 'Provider Keys',
      hint: 'Saved in the workspace vault',
      emptyHint: '0 • No keys saved in vault',
      href: '/app/settings',
      icon: <Key className="w-4 h-4 text-brand-loom" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const count = summary ? summary[card.key] : null;
        const hintText =
          count === 0 ? card.emptyHint : card.hint;

        return (
          <Link
            key={card.key}
            href={card.href}
            className="block group rounded-xl transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom"
          >
            <StatCard
              label={card.label}
              value={renderValue(summaryState, card.key, onRetry)}
              hint={hintText}
              icon={
                <div className="flex items-center gap-1.5 text-text-muted group-hover:text-brand-loom transition-colors">
                  {card.icon}
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              }
              className="group-hover:border-border-muted transition-colors cursor-pointer"
            />
          </Link>
        );
      })}
    </div>
  );
}
