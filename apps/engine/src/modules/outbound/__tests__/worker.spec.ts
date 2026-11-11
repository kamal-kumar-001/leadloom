import { describe, it, expect } from 'vitest';
import { OutboundWorker } from '../worker';

const fakeDispatch = (results: Record<string, 'idle' | 'accepted' | 'uncertain' | Error>) => ({
  dispatchOnce: async (_w: string, c: string) => {
    const r = results[c];
    if (r instanceof Error) throw r;
    return r ?? 'idle';
  },
});

describe('OutboundWorker', () => {
  it('tick dispatches every active campaign and aggregates outcomes', async () => {
    const worker = new OutboundWorker(
      fakeDispatch({ c1: 'accepted', c2: 'uncertain', c3: 'idle' }) as never,
      { listActiveCampaigns: async () => [{ workspaceId: 'w', campaignId: 'c1' }, { workspaceId: 'w', campaignId: 'c2' }, { workspaceId: 'w', campaignId: 'c3' }] },
    );
    expect(await worker.tick()).toEqual({ campaigns: 3, accepted: 1, uncertain: 1, idle: 1, errors: 0 });
  });

  it("one campaign's failure is counted and never kills the tick", async () => {
    const worker = new OutboundWorker(
      fakeDispatch({ c1: new Error('db down'), c2: 'accepted' }) as never,
      { listActiveCampaigns: async () => [{ workspaceId: 'w', campaignId: 'c1' }, { workspaceId: 'w', campaignId: 'c2' }] },
    );
    const res = await worker.tick();
    expect(res.errors).toBe(1);
    expect(res.accepted).toBe(1);
  });

  it('start runs ticks on the interval and stop halts them', async () => {
    let ticks = 0;
    const dispatch = { dispatchOnce: async () => { ticks++; return 'idle' as const; } };
    const worker = new OutboundWorker(dispatch, { listActiveCampaigns: async () => [{ workspaceId: 'w', campaignId: 'c1' }] }, { intervalMs: 10 });
    worker.start();
    await new Promise((r) => setTimeout(r, 45));
    worker.stop();
    const stoppedAt = ticks;
    expect(stoppedAt).toBeGreaterThanOrEqual(2);
    await new Promise((r) => setTimeout(r, 30));
    expect(ticks).toBe(stoppedAt);
  });
});
