import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWaterfallJobStatus } from '../engine-client';

/** D3 client honesty: engine bodies must survive on ANY status; no invented
 *  progress, needs_review surfaced explicitly, unavailable never faked. */
describe('getWaterfallJobStatus', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })) as any);

  it('maps a real status payload, preserving needs_review and counters', async () => {
    stub(200, { jobId: crypto.randomUUID(), status: 'needs_review', totalQueued: 3, completedCount: 2, uncertainCount: 1, attempts: 1, error: '1 row(s) uncertain' });
    const out = await getWaterfallJobStatus('x');
    expect(out.state).toBe('ok');
    if (out.state === 'ok') {
      expect(out.status).toBe('needs_review');
      expect(out.uncertainCount).toBe(1);
      expect(out.completedCount).toBe(2);
    }
  });

  it('503 keeps the engine message (unavailable), never a fabricated status', async () => {
    stub(503, { error: 'Waterfall dispatch unavailable', message: 'Durable job persistence is not implemented yet; no status can be read.', queued: false });
    const out = await getWaterfallJobStatus('x');
    expect(out).toEqual({ state: 'unavailable', message: 'Durable job persistence is not implemented yet; no status can be read.' });
  });

  it('404 (foreign or unknown job) maps to not_found without detail', async () => {
    stub(404, { error: 'Waterfall job not found' });
    expect(await getWaterfallJobStatus('x')).toEqual({ state: 'not_found' });
  });

  it('network failure is an honest error, never a fake status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }) as any);
    const out = await getWaterfallJobStatus('x');
    expect(out.state).toBe('error');
  });
});
