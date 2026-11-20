import React from 'react';
import { Badge } from '@leadloom/ui';
import { ExternalLink, ShieldCheck, Clock, XCircle } from 'lucide-react';

export interface DraftView {
  id: string;
  productId: string;
  destinationUrl: string;
  identity: string | null;
  body: string;
  claimsUsed: string[];
  status: 'pending' | 'approved' | 'rejected';
  statusNote: string;
  createdAt: string;
  decidedAt: string | null;
}

const STATUS_STYLE: Record<DraftView['status'], { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: 'PENDING REVIEW', className: 'text-accent-loom border-accent-loom/40 bg-accent-loom/10', Icon: Clock },
  approved: { label: 'APPROVED - NOT POSTED - REVIEW ONLY', className: 'text-signal-verified border-signal-verified/40 bg-signal-verified/10', Icon: ShieldCheck },
  rejected: { label: 'REJECTED', className: 'text-signal-failed border-signal-failed/40 bg-signal-failed/10', Icon: XCircle },
};

export function DraftCard({ draft, actions }: { draft: DraftView; actions?: React.ReactNode }) {
  const st = STATUS_STYLE[draft.status];
  return (
    <div className="rounded-lg border border-border-subtle bg-canvas-elevated/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${st.className}`}>
          <st.Icon className="h-3 w-3" /> {st.label}
        </span>
        <span className="text-[10px] text-text-muted font-mono">created {draft.createdAt}</span>
      </div>
      <pre className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed font-sans bg-canvas-surface border border-border-subtle rounded-md p-2.5">
{draft.body}
      </pre>
      <div className="grid gap-1 text-[11px] text-text-secondary font-mono">
        <div className="flex items-center gap-1 break-all">
          destination: {draft.destinationUrl}
          <a href={draft.destinationUrl} target="_blank" rel="noreferrer" className="text-brand-loom"><ExternalLink className="h-3 w-3" /></a>
        </div>
        <div>posting identity: {draft.identity ?? 'none connected - review only, nothing can post'}</div>
        <div>product: {draft.productId} - claims from the product's own public pages (fetched 2026-11-19); marketing claims, not independently verified reliability</div>
      </div>
      <div className="text-[11px] text-text-muted">{draft.statusNote}</div>
      {actions && <div className="flex gap-2 pt-1">{actions}</div>}
    </div>
  );
}

export function DraftStatusBadge({ status }: { status: DraftView['status'] }) {
  const st = STATUS_STYLE[status];
  return <Badge>{st.label}</Badge>;
}
