import React from 'react';
import { Card, Badge } from '@leadloom/ui';
import { Radar, ExternalLink, AlertTriangle, Database, Hand, PlugZap } from 'lucide-react';
import {
  SignalRowView,
  SourceStatus,
  SOURCE_STATUSES,
} from '../../lib/signals-view-model';
import { LiveHnButton } from './live-hn-button';
import { DraftComposerButton } from './draft-composer';
import { DraftCard, type DraftView } from './draft-card';

const PROVENANCE_STYLE: Record<SignalRowView['provenance'], { label: string; className: string }> = {
  'recorded-fixture': {
    label: 'Recorded fixture - HN API 2026-11-19',
    className: 'bg-canvas-elevated text-text-muted border border-border-subtle',
  },
  'manual-sample': {
    label: 'Manual import - sample',
    className: 'bg-accent-loom/15 text-accent-loom border border-accent-loom/30',
  },
  'live-hn': {
    label: 'Live HN Algolia',
    className: 'bg-signal-verified/15 text-signal-verified border border-signal-verified/30',
  },
};

function SourceStatusCard({ status }: { status: SourceStatus }) {
  const icon =
    status.state === 'fixture' ? (
      <Database className="h-4 w-4 text-brand-loom" />
    ) : status.state === 'manual-only' ? (
      <Hand className="h-4 w-4 text-accent-loom" />
    ) : (
      <PlugZap className="h-4 w-4 text-text-muted" />
    );
  const stateLabel =
    status.state === 'fixture' ? 'fixture-backed' : status.state === 'manual-only' ? 'manual import only' : 'not connected';
  return (
    <Card className="p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {icon}
          {status.label}
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wide text-text-muted">{stateLabel}</span>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed">{status.detail}</p>
      {status.termsUrl && (
        <a
          href={status.termsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-brand-loom hover:underline"
        >
          Source terms <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </Card>
  );
}

function SignalRow({ row }: { row: SignalRowView }) {
  const prov = PROVENANCE_STYLE[row.provenance];
  return (
    <Card className="p-4 space-y-2">
      <div className="space-y-1">
        <div className="text-sm font-medium text-text-primary break-words">{row.title || '(no title)'}</div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-text-muted font-mono">
            {row.source} {row.author ? `- ${row.author}` : ''} {row.postedAt ? `- ${row.postedAt}` : ''}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${prov.className}`}>
            {prov.label}
          </span>
        </div>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed">{row.excerpt}</p>
      {row.url && (
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-brand-loom hover:underline break-all"
        >
          {row.url} <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      )}
      {row.match ? (
        <div className="rounded-lg bg-brand-loom/10 border border-brand-loom/25 p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-loom">
              Best match: {row.match.displayName}
            </span>
            <Badge>{row.match.score.toFixed(2)}</Badge>
          </div>
          <div className="text-[11px] text-text-secondary font-mono">{row.match.explanation}</div>
        </div>
      ) : (
        <div className="text-[11px] text-text-muted italic">No product match above zero.</div>
      )}
      <DraftComposerButton row={row} />
    </Card>
  );
}

export function SignalsView({
  rows,
  queue,
  queueLabel,
}: {
  rows: SignalRowView[];
  queue?: DraftView[];
  queueLabel?: string;
}) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Radar className="h-5 w-5" /> Signals
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          People describing problems our products solve. Keyword/phrase matching only, provisional
          scoring, every row shows its provenance. Replies are drafted later and always need your
          approval before anything is posted.
        </p>
      </div>

      <div className="rounded-lg border border-border-subtle bg-canvas-elevated/40 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-accent-loom shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Nothing here posts anywhere. Keyword matching over-fires on news and off-topic mentions;
          low scores and your review are the controls. Live HN fetch runs once per click, no polling.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCE_STATUSES.map((s) => (
          <SourceStatusCard key={s.id} status={s} />
        ))}
      </div>

      <LiveHnButton />

      {queue && queue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Reply approval queue ({queue.length}){queueLabel ? ` - ${queueLabel}` : ''}
          </h2>
          <p className="text-[11px] text-text-muted">
            Session-only: drafts vanish when the server restarts. Approving records your review of
            the exact text, destination and identity above, and nothing more: nothing is posted (no
            posting integration is connected), and approval is not authorization to post later under
            any identity. Drafts are private to your account; other users cannot see or decide on them.
          </p>
          {queue.map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Inbox ({rows.length} rows)</h2>
        {rows.map((row) => (
          <SignalRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}
