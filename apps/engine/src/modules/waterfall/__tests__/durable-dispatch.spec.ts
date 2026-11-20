import { describe, it, expect } from 'vitest';
import { buildDurableWaterfallDispatch } from '../durable-dispatch';

/**
 * Poll-loop assembly over fakes: no DB, no timers beyond short real
 * intervals, no provider contact. Proves loop behavior only - recovery once
 * at start, non-overlapping ticks, error survival, clean stop.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeStore(queued: string[], running: string[]) {
  const calls: string[][] = [];
  return {
    calls,
    store: {
      listWorkspacesWithJobs: async (statuses: string[]) => {
        calls.push(statuses);
        return statuses.includes('queued') ? queued : running;
      },
    } as any,
  };
}

describe('buildDurableWaterfallDispatch', () => {
  it('recovers running workspaces once at start, then drains queued workspaces per tick', async () => {
    const { store, calls } = fakeStore(['ws-a'], ['ws-stale']);
    const order: string[] = [];
    const worker = {
      recoverOnStart: async (ws: string) => { order.push(`recover:${ws}`); },
      runQueued: async (ws: string) => { order.push(`run:${ws}`); return []; },
    } as any;
    const d = buildDurableWaterfallDispatch({ store, worker, pollIntervalMs: 10_000 });
    d.start();
    await sleep(30);
    d.stop();
    expect(order[0]).toBe('recover:ws-stale');
    expect(order.filter((o) => o === 'run:ws-a').length).toBe(1);
    expect(calls[0]).toEqual(['running']);
    expect(calls).toContainEqual(['queued']);
  });

  it('never overlaps ticks even when a tick outlasts the interval', async () => {
    const { store } = fakeStore(['ws-a'], []);
    let inFlight = 0;
    let maxInFlight = 0;
    let runs = 0;
    const worker = {
      recoverOnStart: async () => {},
      runQueued: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        runs += 1;
        await sleep(40);
        inFlight -= 1;
        return [];
      },
    } as any;
    const d = buildDurableWaterfallDispatch({ store, worker, pollIntervalMs: 10 });
    d.start();
    await sleep(120);
    d.stop();
    expect(maxInFlight).toBe(1);
    expect(runs).toBeGreaterThanOrEqual(2);
  });

  it('surfaces tick errors and keeps polling; stop prevents further ticks', async () => {
    let queuedCalls = 0;
    const store = {
      listWorkspacesWithJobs: async (statuses: string[]) => {
        if (!statuses.includes('queued')) return [];
        queuedCalls += 1;
        if (queuedCalls === 1) throw new Error('store blip');
        return [];
      },
    } as any;
    const errors: unknown[] = [];
    const worker = { recoverOnStart: async () => {}, runQueued: async () => [] } as any;
    const d = buildDurableWaterfallDispatch({ store, worker, pollIntervalMs: 10, onError: (e) => errors.push(e) });
    d.start();
    await sleep(45);
    d.stop();
    const callsAtStop = queuedCalls;
    expect(errors.length).toBe(1);
    expect((errors[0] as Error).message).toBe('store blip');
    expect(callsAtStop).toBeGreaterThanOrEqual(2); // loop survived the error
    await sleep(30);
    expect(queuedCalls).toBe(callsAtStop); // no ticks after stop
  });

  it('exposes the durable queue and reports running state', () => {
    const { store } = fakeStore([], []);
    const worker = { recoverOnStart: async () => {}, runQueued: async () => [] } as any;
    const d = buildDurableWaterfallDispatch({ store, worker });
    expect(d.queue).toBeDefined();
    expect(d.isRunning()).toBe(false);
    d.start();
    expect(d.isRunning()).toBe(true);
    d.stop();
    expect(d.isRunning()).toBe(false);
  });
});

describe('mountDurableWaterfallDispatch', () => {
  // Imported lazily to keep the loop tests above independent.
  const load = async () => (await import('../durable-dispatch')).mountDurableWaterfallDispatch;

  it('does nothing when the flag is not set', async () => {
    const mount = await load();
    let touched = false;
    const prisma = { $queryRawUnsafe: async () => { touched = true; return []; } };
    const out = await mount({ env: {}, prisma, runner: {} as any, log: () => {} });
    expect(out).toBeNull();
    expect(touched).toBe(false);
  });

  it('flag on without a database: loud log, no mount, unavailable posture preserved', async () => {
    const mount = await load();
    const logs: string[] = [];
    const out = await mount({ env: { LEADLOOM_WATERFALL_DURABLE_DISPATCH: 'true' }, prisma: null, runner: {} as any, log: (m) => logs.push(m) });
    expect(out).toBeNull();
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatch(/stays OFF/);
  });

  it('flag on but the proposed table is MISSING: no mount, no loop start, no retries, nothing applied', async () => {
    const mount = await load();
    const queries: string[] = [];
    // fake prisma answers the readiness probe with NO table present and
    // records every query it is asked - after a failed readiness check there
    // must be NONE (no polling loop, no enqueue, no DDL).
    const prisma = { $queryRawUnsafe: async (sql: string) => { queries.push(sql); return []; } };
    const logs: string[] = [];
    const out = await mount({
      env: { LEADLOOM_WATERFALL_DURABLE_DISPATCH: 'true' },
      prisma,
      runner: {} as any,
      pollIntervalMs: 10_000,
      log: (m) => logs.push(m),
    });
    expect(out).toBeNull();
    expect(logs.join('\n')).toMatch(/stays OFF/);
    expect(logs.join('\n')).toMatch(/missing/i);
    // exactly ONE query total: the information_schema readiness probe.
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/information_schema\.tables/);
    expect(queries[0]).not.toMatch(/CREATE TABLE/i);
  });

  it('flag on but the readiness probe FAILS (connectivity): no mount, loud log', async () => {
    const mount = await load();
    const prisma = { $queryRawUnsafe: async () => { throw new Error('db unreachable'); } };
    const logs: string[] = [];
    const out = await mount({
      env: { LEADLOOM_WATERFALL_DURABLE_DISPATCH: 'true' },
      prisma,
      runner: {} as any,
      log: (m) => logs.push(m),
    });
    expect(out).toBeNull();
    expect(logs.join('\n')).toMatch(/probe failed|db unreachable/i);
  });

  it('flag on with a database AND the proposed table present: assembles and starts; stop() ends polling', async () => {
    const mount = await load();
    const queries: string[] = [];
    let probeCalls = 0;
    const prisma = {
      $queryRawUnsafe: async (sql: string) => {
        queries.push(sql);
        if (sql.includes('information_schema')) { probeCalls += 1; return [{ name: 'enrichment_jobs' }]; }
        return [];
      },
    };
    const out = await mount({
      env: { LEADLOOM_WATERFALL_DURABLE_DISPATCH: 'true' },
      prisma,
      runner: {} as any,
      pollIntervalMs: 10_000,
      log: () => {},
    });
    expect(out).not.toBeNull();
    expect(probeCalls).toBe(1);
    expect(out!.isRunning()).toBe(true);
    expect(out!.queue).toBeDefined();
    await sleep(30); // recovery + first tick
    expect(queries.some((q) => q.includes('DISTINCT workspace_id'))).toBe(true);
    out!.stop();
    expect(out!.isRunning()).toBe(false);
  });
});
