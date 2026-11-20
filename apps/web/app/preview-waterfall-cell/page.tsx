'use client';
// LOCAL HARNESS PREVIEW ONLY (visual verification of D3 cell states).
// Not linked anywhere; renders static fixture payloads, no engine calls.
import React from 'react';
import { WaterfallCell } from '@/components/grid/cells/waterfall-cell';
import type { WaterfallCellPayload } from '@leadloom/contracts';

const trace = [
  { step: 1, provider: 'apollo' as const, status: 'miss' as const, latency_ms: 210, cost_microcents: 100, reason: 'No record found' },
  { step: 2, provider: 'hunter' as const, status: 'hit' as const, latency_ms: 180, cost_microcents: 300, reason: 'Match found' },
];

const success: WaterfallCellPayload = {
  value: 'ada@northstar.example', status: 'success', trace,
  telemetry: { provider_attributed: 'apollo', tier: 1, latency_ms: 210, cost_microcents: 100 },
};
const fallback: WaterfallCellPayload = {
  value: 'grace@acme.example', status: 'fallback_used', trace,
  telemetry: { provider_attributed: 'hunter', tier: 2, latency_ms: 390, cost_microcents: 400 },
};
const errored: WaterfallCellPayload = {
  value: null, status: 'error', trace,
  telemetry: { latency_ms: 390, cost_microcents: 400, cost_assumed: true },
  error_payload: { code: 'RATE_LIMIT_EXCEEDED', message: 'All configured providers hit rate limits', retryable: true },
};
const exhausted: WaterfallCellPayload = {
  value: null, status: 'exhausted', trace,
  telemetry: { latency_ms: 620, cost_microcents: 700, cost_assumed: true },
};
const simulated: WaterfallCellPayload = {
  value: 'verified@demo-rows.example.com', status: 'success', trace, simulated: true,
  telemetry: { provider_attributed: 'hunter', tier: 2, latency_ms: 135, cost_microcents: 300, cost_assumed: true },
};

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-canvas-base p-6 space-y-4">
      <h1 className="text-text-primary font-mono text-sm">Waterfall cell states (local preview)</h1>
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-center gap-3"><span className="w-24 text-text-muted">success</span><WaterfallCell payload={success} /></div>
        <div className="flex items-center gap-3"><span className="w-24 text-text-muted">fallback</span><WaterfallCell payload={fallback} /></div>
        <div className="flex items-center gap-3" data-shot="error-cell"><span className="w-24 text-text-muted">error</span><WaterfallCell payload={errored} /></div>
        <div className="flex items-center gap-3" data-shot="sim-cell"><span className="w-24 text-text-muted">simulated</span><WaterfallCell payload={simulated} /></div>
        <div className="flex items-center gap-3"><span className="w-24 text-text-muted">exhausted</span><WaterfallCell payload={exhausted} /></div>
        <div className="flex items-center gap-3"><span className="w-24 text-text-muted">queued</span><WaterfallCell payload={{ value: null, status: 'queued', trace: [] }} /></div>
        <div className="flex items-center gap-3"><span className="w-24 text-text-muted">idle</span><WaterfallCell payload={null} /></div>
      </div>
      <p id="preview-ready" className="text-text-muted text-[10px]">preview-ready</p>
    </main>
  );
}
