import { describe, it, expect } from 'vitest';
import { waterfallCellView, waterfallCostLabel } from '../waterfall-cell-view-model';
import type { WaterfallCellPayload } from '@leadloom/contracts';

const base = { value: null, status: 'idle' as const, trace: [] };

describe('waterfallCellView (D3 honesty)', () => {
  it('idle/null render empty', () => {
    expect(waterfallCellView(null).kind).toBe('empty');
    expect(waterfallCellView(base).kind).toBe('empty');
  });
  it('queued/running render in_progress', () => {
    expect(waterfallCellView({ ...base, status: 'queued' }).kind).toBe('in_progress');
    expect(waterfallCellView({ ...base, status: 'running' }).kind).toBe('in_progress');
  });
  it('error payload renders FAILED with the engine message - never a success', () => {
    const p: WaterfallCellPayload = { ...base, status: 'error', error_payload: { code: 'RATE_LIMIT_EXCEEDED', message: 'All configured providers hit rate limits', retryable: true } };
    const v = waterfallCellView(p);
    expect(v.kind).toBe('failed');
    if (v.kind === 'failed') { expect(v.label).toContain('rate limits'); expect(v.retryable).toBe(true); }
  });
  it('exhausted renders FAILED with a no-result fallback message', () => {
    const v = waterfallCellView({ ...base, status: 'exhausted' });
    expect(v.kind).toBe('failed');
    if (v.kind === 'failed') expect(v.label).toMatch(/no result/i);
  });
  it('a success-shaped payload with a NULL value is a failure, not a success', () => {
    expect(waterfallCellView({ ...base, status: 'success', value: null }).kind).toBe('failed');
  });
  it('fallback_used with a value renders success marked as fallback', () => {
    const v = waterfallCellView({ ...base, status: 'fallback_used', value: 'a@b.co', telemetry: { provider_attributed: 'hunter', latency_ms: 10, cost_microcents: 100 } });
    expect(v).toMatchObject({ kind: 'success', fallback: true, provider: 'hunter' });
  });
});

describe('waterfallCostLabel (assumed billing never shown as measured)', () => {
  it('no telemetry -> no cost line', () => {
    expect(waterfallCostLabel(base).kind).toBe('none');
  });
  it('cost_assumed=true renders Estimated charge (unverified) - never a proven maximum', () => {
    const c = waterfallCostLabel({ ...base, telemetry: { latency_ms: 1, cost_microcents: 250, cost_assumed: true } });
    expect(c).toMatchObject({ kind: 'estimated', amount: '$0.0025' });
    if (c.kind === 'estimated') {
      expect(c.note).toContain('Estimated charge (unverified)');
      expect(c.note).not.toMatch(/max/i); // not a ceiling guarantee
    }
  });
  it('ordinary telemetry renders measured', () => {
    expect(waterfallCostLabel({ ...base, telemetry: { latency_ms: 1, cost_microcents: 100 } })).toEqual({ kind: 'measured', amount: '$0.0010' });
  });
});

describe('simulated (demo) payloads are visibly sample data', () => {
  const simSuccess: WaterfallCellPayload = {
    value: 'verified@loom-outreach.dev',
    status: 'success',
    trace: [],
    simulated: true,
    telemetry: { provider_attributed: 'hunter', tier: 2, latency_ms: 135, cost_microcents: 300, cost_assumed: true },
  };

  it('success view is marked simulated and its trace header says [Sample]', () => {
    const v = waterfallCellView(simSuccess);
    expect(v.kind).toBe('success');
    if (v.kind === 'success') {
      expect(v.simulated).toBe(true);
      expect(v.traceHeader).toBe('[Sample] Early Exit');
    }
  });

  it('cost label is a sample note, never an amount - even without cost_assumed', () => {
    expect(waterfallCostLabel(simSuccess)).toEqual({ kind: 'sample', note: 'Sample data: no provider call or charge' });
    const noAssumedFlag: WaterfallCellPayload = {
      ...simSuccess,
      telemetry: { provider_attributed: 'hunter', tier: 2, latency_ms: 135, cost_microcents: 300 },
    };
    expect(waterfallCostLabel(noAssumedFlag).kind).toBe('sample');
  });

  it('non-simulated success stays unmarked', () => {
    const v = waterfallCellView({ ...simSuccess, simulated: undefined });
    expect(v.kind).toBe('success');
    if (v.kind === 'success') {
      expect(v.simulated).toBe(false);
      expect(v.traceHeader).toBe('Early Exit');
    }
  });
});
