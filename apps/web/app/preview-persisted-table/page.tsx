'use client';
// LOCAL HARNESS PREVIEW ONLY (visual verification of persisted waterfall cells).
// Not linked anywhere; renders static fixture rows, no engine calls.
import React from 'react';
import { PersistedTableView } from '@/components/grid/persisted-table-view';
import type { WorkspaceTableRows } from '@/lib/engine-client';
import type { WaterfallCellPayload } from '@leadloom/contracts';

const trace = [
  { step: 1, provider: 'apollo' as const, status: 'miss' as const, latency_ms: 210, cost_microcents: 100, reason: 'No record found' },
  { step: 2, provider: 'hunter' as const, status: 'hit' as const, latency_ms: 180, cost_microcents: 300, reason: 'Match found' },
];

const success: WaterfallCellPayload = {
  value: 'ada@northstar.example', status: 'success', trace,
  telemetry: { provider_attributed: 'apollo', tier: 1, latency_ms: 210, cost_microcents: 100 },
};
const errored: WaterfallCellPayload = {
  value: null, status: 'error', trace,
  telemetry: { latency_ms: 390, cost_microcents: 400, cost_assumed: true },
  error_payload: { code: 'RATE_LIMIT_EXCEEDED', message: 'All configured providers hit rate limits', retryable: true },
};

const fixture: WorkspaceTableRows = {
  table: { id: 'fixture-table', name: 'Q4 Outreach Leads (fixture)', rowCount: 3 },
  columns: [
    { id: 'col-name', name: 'Name', type: 'text' },
    { id: 'col-email', name: 'Work Email', type: 'waterfall' },
    { id: 'col-verified', name: 'Verified', type: 'boolean' },
  ],
  rows: [
    { rowId: 'row-1', values: { Name: 'Ada Lovelace', 'Work Email': success, Verified: true } },
    { rowId: 'row-2', values: { Name: 'Grace Hopper', 'Work Email': errored, Verified: false } },
    // row-3's stored value is NOT a valid payload: must render the muted dash,
    // never a fake success.
    { rowId: 'row-3', values: { Name: 'Alan Turing', 'Work Email': 'pending legacy import', Verified: false } },
  ],
};

export default function PreviewPersistedTablePage() {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set(['row-2']));
  const toggle = (rowId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  return (
    <main className="min-h-screen bg-canvas-base p-6 space-y-4">
      <h1 className="text-text-primary font-mono text-sm">Persisted table waterfall cells (local preview)</h1>
      <div data-shot="persisted-table">
        <PersistedTableView data={fixture} />
      </div>
      <h1 className="text-text-primary font-mono text-sm">With row selection (D3 dispatch binding)</h1>
      <div data-shot="persisted-table-selection">
        <PersistedTableView data={fixture} selection={{ selected, onToggle: toggle }} />
      </div>
    </main>
  );
}
