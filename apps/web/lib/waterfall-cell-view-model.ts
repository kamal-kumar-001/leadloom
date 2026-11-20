import type { WaterfallCellPayload } from '@leadloom/contracts';

/**
 * D3 honest cell view-model: what a waterfall cell may claim, derived ONLY
 * from the persisted payload. Never implies success on an error/exhausted
 * payload, never presents assumed cost as measured spend.
 */
export type WaterfallCellView =
  | { kind: 'empty' }
  | { kind: 'in_progress'; label: string }
  | { kind: 'success'; value: string; provider?: string; fallback: boolean; simulated: boolean; traceHeader: string }
  | {
      kind: 'failed';
      label: string;
      retryable: boolean;
      traceHeader: string;
    };

export type WaterfallCostLabel =
  | { kind: 'none' }
  // Demo/simulated payload: no provider call happened, so there is nothing
  // to price. Rendered as a sample note, never as an amount.
  | { kind: 'sample'; note: string }
  // 'measured' is RESERVED for source-measured charges (provider-reported
  // usage, e.g. Hunter's X-Credits-Used header, or a genuine $0.00 cache hit).
  // A nominal adapter price is NOT measured - it arrives with cost_assumed.
  | { kind: 'measured'; amount: string }
  | { kind: 'estimated'; amount: string; note: string };

export function waterfallCellView(payload: WaterfallCellPayload | null): WaterfallCellView {
  if (!payload || payload.status === 'idle') return { kind: 'empty' };
  if (payload.status === 'queued' || payload.status === 'running') {
    return { kind: 'in_progress', label: 'Cascading...' };
  }
  if ((payload.status === 'success' || payload.status === 'fallback_used') && payload.value) {
    const simulated = payload.simulated === true;
    const base = payload.status === 'fallback_used' ? 'Completed via fallback' : 'Early Exit';
    return {
      kind: 'success',
      value: payload.value,
      provider: payload.telemetry?.provider_attributed,
      fallback: payload.status === 'fallback_used',
      simulated,
      // Demo data must SAY so everywhere it appears.
      traceHeader: simulated ? `[Sample] ${base}` : base,
    };
  }
  // error / exhausted (or a success-shaped payload with no value): a FAILURE,
  // rendered as one. The message comes from the engine's own error payload.
  return {
    kind: 'failed',
    label: payload.error_payload?.message ?? 'No result from any configured provider',
    retryable: payload.error_payload?.retryable === true,
    traceHeader: payload.status === 'exhausted' ? 'All providers exhausted' : 'Run failed',
  };
}

export function waterfallCostLabel(payload: WaterfallCellPayload | null): WaterfallCostLabel {
  if (payload?.simulated) {
    return { kind: 'sample', note: 'Sample data: no provider call or charge' };
  }
  const telemetry = payload?.telemetry;
  if (!telemetry) return { kind: 'none' };
  const amount = `$${(telemetry.cost_microcents / 100000).toFixed(4)}`;
  // cost_assumed: billing policy for error/miss responses is UNVERIFIED.
  // The nominal rate is an ESTIMATE, not a proven maximum - the real charge
  // could be higher or lower, so this is never a spending-ceiling guarantee
  // and never presented as measured spend.
  if (telemetry.cost_assumed) {
    return { kind: 'estimated', amount, note: 'Estimated charge (unverified): provider billing for misses/errors is unknown' };
  }
  return { kind: 'measured', amount };
}
