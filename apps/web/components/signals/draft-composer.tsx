'use client';

import React, { useState } from 'react';
import { Button } from '@leadloom/ui';
import { PenLine } from 'lucide-react';
import type { SignalRowView } from '../../lib/signals-view-model';
import { DraftCard, type DraftView } from './draft-card';

export function DraftComposerButton({ row }: { row: SignalRowView }) {
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!row.match) return null;

  async function createDraft() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/signals/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: row.match!.productId,
          post: {
            source: row.source,
            externalId: row.externalId,
            title: row.title,
            text: row.text,
            url: row.url,
            author: row.author,
            postedAt: row.postedAt,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? `Failed (${res.status})`);
      else setDraft(body.draft);
    } catch {
      setError('Network error.');
    }
    setBusy(false);
  }

  return (
    <div className="pt-1 space-y-2">
      {!draft && (
        <Button onClick={createDraft} disabled={busy}>
          <PenLine className="h-3.5 w-3.5 mr-1.5" />
          {busy ? 'Drafting...' : 'Draft a reply for review'}
        </Button>
      )}
      {error && <div className="text-xs text-signal-failed">{error}</div>}
      {draft && (
        <DraftCard
          draft={draft}
          actions={draft.status === 'pending' ? <DecisionButtons draft={draft} onDone={setDraft} /> : undefined}
        />
      )}
    </div>
  );
}

function DecisionButtons({ draft, onDone }: { draft: DraftView; onDone: (d: DraftView) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signals/drafts/${draft.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Sends back the exact values under review; the server refuses if
        // they differ from the stored draft by one byte.
        body: JSON.stringify({
          decision,
          body: draft.body,
          destinationUrl: draft.destinationUrl,
          identity: draft.identity,
        }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? `Failed (${res.status})`);
      else onDone(body.draft);
    } catch {
      setError('Network error.');
    }
    setBusy(false);
  }

  return (
    <>
      <Button onClick={() => decide('approved')} disabled={busy}>Approve (review only - does not post)</Button>
      <Button onClick={() => decide('rejected')} disabled={busy}>Reject</Button>
      {error && <span className="text-xs text-signal-failed self-center">{error}</span>}
    </>
  );
}
