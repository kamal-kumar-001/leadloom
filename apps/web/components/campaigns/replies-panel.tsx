'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Card } from '@leadloom/ui';
import { Inbox, RefreshCw } from 'lucide-react';
import { fetchInboundReplies, type InboundReplyRow } from '../../lib/engine-client';

const CLASSIFICATION_TONE: Record<InboundReplyRow['classification'], string> = {
  interested: 'text-signal-verified',
  objection: 'text-signal-failed',
  out_of_office: 'text-text-muted',
  unsubscribe: 'text-signal-failed',
  neutral: 'text-text-secondary',
  bounce: 'text-signal-pending',
};

const ATTRIBUTION_LABEL: Record<InboundReplyRow['attribution'], string> = {
  thread_header: 'matched to message',
  recipient_match: 'matched to recipient',
  ambiguous_recipient: 'ambiguous (multiple campaigns) - nothing halted',
  unattributed: 'unattributed',
};

/**
 * G10: read-only list of replies recorded by the (fixture-only) reply sync.
 * Nothing here sends or changes anything; it shows what the engine persisted.
 */
export function RepliesPanel() {
  const [items, setItems] = useState<InboundReplyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchInboundReplies();
    if (res.error) setError(res.error);
    else setItems(res.data?.items ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Inbox className="w-4 h-4 text-brand-loom" />
            <span>Recorded Replies</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Replies recorded by reply sync. An attributed reply halts that recipient's remaining sequence; ambiguous or unattributed replies halt nothing.
          </p>
        </div>
        <button onClick={load} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 font-mono">
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <Card className="p-4 animate-pulse">
          <div className="h-4 w-56 bg-canvas-elevated rounded" />
        </Card>
      ) : error ? (
        <Card className="p-4 border-signal-failed/30 bg-signal-failed/5">
          <p className="text-sm text-signal-failed">Failed to load replies</p>
          <p className="text-xs text-text-muted mt-0.5">{error}</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-text-secondary">No replies recorded yet.</p>
          <p className="text-xs text-text-muted mt-0.5">Reply sync is disabled in this deployment; replies appear here only after it runs.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <Card key={r.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary font-mono truncate">{r.fromEmail}</span>
                  <span className={`text-[11px] font-mono ${CLASSIFICATION_TONE[r.classification]}`}>{r.classification.replace(/_/g, ' ')}</span>
                </div>
                {r.subject && <p className="text-xs text-text-secondary truncate">{r.subject}</p>}
                <p className="text-[11px] font-mono text-text-muted">{ATTRIBUTION_LABEL[r.attribution]}</p>
              </div>
              <Badge variant="subtle" className="text-[10px] font-mono shrink-0 self-start sm:self-auto">
                {new Date(r.receivedAt).toLocaleString()}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
