import React from 'react';
import { notFound } from 'next/navigation';
import {
  PRODUCT_PROFILES,
  ReplyDraftStore,
} from '@leadloom/engine/src/modules/signals-ingest';
import { buildDemoSignalsView } from '../../lib/signals-view-model';
import { SignalsView } from '../../components/signals/signals-view';

export const dynamic = 'force-dynamic';

/**
 * Unauthenticated DEV PREVIEW of the /app/signals slice so the UI can be
 * reviewed without a session + engine. Fixture/sample data only, disabled in
 * production. The queue below is a SAMPLE built in a throwaway store; the
 * Draft buttons call the real API and will 401 here, which is correct.
 */
export default function SignalsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const { rows } = buildDemoSignalsView();

  const sample = new ReplyDraftStore();
  const matched = rows.filter((r) => r.match);
  for (const r of matched.slice(0, 2)) {
    const profile = PRODUCT_PROFILES.find((p) => p.productId === r.match!.productId)!;
    sample.create(
      {
        source: r.source,
        externalId: r.externalId,
        title: r.title,
        text: r.text,
        url: r.url,
        author: r.author,
        postedAt: r.postedAt,
      },
      profile,
    );
  }
  const queue = sample.list();
  if (queue[1]) {
    sample.decide(queue[1].id, 'approved', {
      body: queue[1].body,
      destinationUrl: queue[1].destinationUrl,
      identity: queue[1].identity,
    });
  }

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-4xl mx-auto mb-4 rounded-md border border-accent-loom/40 bg-accent-loom/10 px-3 py-2 text-[11px] font-mono text-accent-loom">
        DEV PREVIEW of /app/signals - unauthenticated, fixture + sample data only, disabled in production
      </div>
      <SignalsView rows={rows} queue={sample.list()} queueLabel="sample" />
    </div>
  );
}
