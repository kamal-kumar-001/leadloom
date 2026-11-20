import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  DurableWaterfallDispatchQueue,
  WaterfallDispatchWorker,
  idempotencyKeyFor,
  type EnrichmentJobsStore,
  type EnrichmentJobRow,
  type NewEnrichmentJob,
} from '../dispatch-queue';
import { GridDispatchRowSource, GridDispatchResultSink, GridNodeConfigResolver, sqlGridAccess } from '../grid-dispatch.ports';
import { sqlEnrichmentJobsStore, type SqlExecutor } from '../sql-enrichment-jobs-store';
import { WaterfallService } from '../waterfall.service';
import { DAGRunnerService, WaterfallNodeConfig } from '../dag-runner.service';
import { DomainCacheService } from '../domain-cache.service';
import { MockProviderAdapter } from '../adapters/mock.adapter';
import type { WaterfallCellPayload } from '@leadloom/contracts';

/**
 * D2 durable dispatch on REAL SQL over an isolated disposable PGlite fixture.
 * No live DB, no host effect, no production data; production migration and
 * worker activation stay OFF. Semantics proven here: AT-LEAST-ONCE per row
 * narrowed by checkpoints. Exactly-once and production concurrency
 * (FOR UPDATE SKIP LOCKED) are NOT claimed.
 */

const DDL = `
CREATE TABLE workspaces (id UUID PRIMARY KEY);
CREATE TABLE tables (id UUID PRIMARY KEY, workspace_id UUID NOT NULL);
CREATE TABLE columns (id UUID PRIMARY KEY, table_id UUID NOT NULL, type VARCHAR(32) NOT NULL, config JSONB NOT NULL DEFAULT '{}');
CREATE TABLE rows (id UUID PRIMARY KEY, table_id UUID NOT NULL);
CREATE TABLE cells (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), row_id UUID NOT NULL, column_id UUID NOT NULL, value JSONB, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(row_id, column_id));
CREATE TABLE enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  column_id UUID NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  row_ids UUID[] NOT NULL,
  total_queued INTEGER NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_row_ids UUID[] NOT NULL DEFAULT '{}',
  started_row_id UUID,
  uncertain_row_ids UUID[] NOT NULL DEFAULT '{}',
  claimed_by VARCHAR(64),
  heartbeat_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX enrichment_jobs_workspace_idempotency_key ON enrichment_jobs(workspace_id, idempotency_key);`;

/**
 * The store under test is the PRODUCTION store module
 * (../sql-enrichment-jobs-store) over a PGlite executor - the same SQL the
 * Prisma adapter will run once the gated migration exists on a host.
 */
const pgliteExec = (pg: PGlite): SqlExecutor => ({
  query: async <T,>(sql: string, params: unknown[]) => (await pg.query(sql, params)).rows as T[],
});

const WS_A = crypto.randomUUID();
const WS_B = crypto.randomUUID();
const TBL = crypto.randomUUID();
const SRC_COL = crypto.randomUUID();
const COL = crypto.randomUUID();
const ROW_1 = crypto.randomUUID();
const ROW_2 = crypto.randomUUID();
const CONFIGS: WaterfallNodeConfig[] = [{ id: 'n1', provider: 'apollo', tier: 1 }];

function makeRunner(executeRow?: (input: { domain: string }) => Promise<WaterfallCellPayload>) {
  const runner = new DAGRunnerService(new DomainCacheService());
  runner.registerAdapter(new MockProviderAdapter({ provider: 'apollo' }));
  if (executeRow) runner.executeRow = executeRow as any;
  return runner;
}
const payloadOf = (v: string): WaterfallCellPayload => ({ value: v, status: 'success', trace: [] });

describe('D2 durable dispatch (PGlite isolated fixture)', () => {
  let pg: PGlite;
  let store: EnrichmentJobsStore;
  beforeEach(async () => {
    pg = new PGlite();
    await pg.exec(DDL);
    await pg.query(`INSERT INTO workspaces (id) VALUES ($1),($2)`, [WS_A, WS_B]);
    await pg.query(`INSERT INTO tables (id, workspace_id) VALUES ($1,$2)`, [TBL, WS_A]);
    await pg.query(`INSERT INTO columns (id, table_id, type, config) VALUES ($1,$2,'waterfall',$3),($4,$2,'text','{}')`,
      [COL, TBL, JSON.stringify({ sourceColumnId: SRC_COL }), SRC_COL]);
    await pg.query(`INSERT INTO rows (id, table_id) VALUES ($1,$3),($2,$3)`, [ROW_1, ROW_2, TBL]);
    await pg.query(`INSERT INTO cells (row_id, column_id, value) VALUES ($1,$3,'"northstar.example"'),($2,$3,'"acme.example"')`,
      [ROW_1, ROW_2, SRC_COL]);
    store = sqlEnrichmentJobsStore(pgliteExec(pg));
  });
  afterEach(async () => { await pg.close(); });

  const dispatchRequest = (rowIds = [ROW_1, ROW_2]) => ({ columnId: COL, rowIds, priority: 'standard' as const });
  const gridSink = () => new GridDispatchResultSink(sqlGridAccess(pgliteExec(pg)));
  const gridRows = () => new GridDispatchRowSource(sqlGridAccess(pgliteExec(pg)));

  it('enqueue persists a queued job; a retried identical dispatch returns the SAME job id and no duplicate row', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const first = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest() });
    const second = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest() });
    expect(second.jobId).toBe(first.jobId);
    const jobs = await store.listByWorkspace(WS_A);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('queued');
    expect(jobs[0].idempotencyKey).toBe(idempotencyKeyFor(WS_A, dispatchRequest()));
  });

  it('tenant isolation: another workspace cannot see, get, or claim the job', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const { jobId } = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest() });
    expect(await store.listByWorkspace(WS_B)).toEqual([]);
    expect(await store.getById(WS_B, jobId)).toBeNull();
    expect(await store.claimNextQueued(WS_B, 'w-b')).toBeNull();
    const other = await queue.enqueue({ workspaceId: WS_B, request: dispatchRequest() });
    expect(other.jobId).not.toBe(jobId);
  });

  it('worker claims -> checkpoints every row -> succeeded; results land in the real cells table', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const { jobId } = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest() });
    const worker = new WaterfallDispatchWorker(store, makeRunner(), gridRows(), gridSink());
    expect(await worker.runQueued(WS_A, CONFIGS)).toEqual([jobId]);
    const job = await store.getById(WS_A, jobId);
    expect(job?.status).toBe('succeeded');
    expect(job?.completedRowIds.sort()).toEqual([ROW_1, ROW_2].sort());
    const cell = await pg.query(`SELECT value FROM cells WHERE row_id=$1 AND column_id=$2`, [ROW_1, COL]);
    expect((cell.rows[0] as any).value.status).toBe('success'); // real SQL write path
  });

  it('partial-completion replay: completed rows never re-run; a provider-stage throw leaves the row UNCERTAIN (needs_review, no blind retry)', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const { jobId } = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest() });
    const executed: string[] = [];
    let calls = 0;
    const flaky = makeRunner(async (input) => {
      executed.push(input.domain);
      if (++calls === 2) throw new Error('timeout after provider request submitted');
      return payloadOf('found@' + input.domain);
    });
    const w1 = new WaterfallDispatchWorker(store, flaky, gridRows(), gridSink(), undefined, [], 'worker-1');
    await w1.runOnce(WS_A, CONFIGS);
    let job = await store.getById(WS_A, jobId);
    expect(job?.status).toBe('queued'); // requeued so untouched rows could continue
    expect(job?.completedRowIds).toEqual([ROW_1]);
    expect(job?.uncertainRowIds).toEqual([ROW_2]); // submitted-then-failed: outcome unknown
    const w2 = new WaterfallDispatchWorker(store, makeRunner(async (input) => {
      executed.push(input.domain);
      return payloadOf('found@' + input.domain);
    }), gridRows(), gridSink(), undefined, [], 'worker-2');
    await w2.runOnce(WS_A, CONFIGS);
    job = await store.getById(WS_A, jobId);
    expect(job?.status).toBe('needs_review'); // surfaced, never blind-retried
    expect(executed.filter((d) => d === 'northstar.example')).toHaveLength(1); // completed row never re-run
    expect(executed.filter((d) => d === 'acme.example')).toHaveLength(1); // submitted once, never re-submitted
  });

  it('a RETURNED error-status payload is written as the row result (billing inference from an error label alone is INVALID - adapter normalization audit pending)', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const { jobId } = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest([ROW_1]) });
    const errorPayload: WaterfallCellPayload = {
      value: null, status: 'error', trace: [],
      error_payload: { code: 'ALL_PROVIDERS_FAILED', message: 'every configured provider returned an error (known outcome)', retryable: true },
    };
    const w = new WaterfallDispatchWorker(store, makeRunner(async () => errorPayload), gridRows(), gridSink());
    await w.runOnce(WS_A, CONFIGS);
    const job = await store.getById(WS_A, jobId);
    expect(job?.status).toBe('succeeded'); // the row COMPLETED with a known failure result
    expect(job?.uncertainRowIds).toEqual([]);
    const cell = await pg.query(`SELECT value FROM cells WHERE row_id=$1 AND column_id=$2`, [ROW_1, COL]);
    expect((cell.rows[0] as any).value.status).toBe('error'); // honest failure lands in the cell
  });

  it('pre-submission failures (row resolution) are provably uncharged: bounded retry applies, no uncertain rows', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const { jobId } = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest([ROW_1]) });
    const failingRows = { resolve: async () => { throw new Error('no sourceColumnId configured'); } };
    const w = new WaterfallDispatchWorker(store, makeRunner(), failingRows, gridSink(), { maxAttempts: 3, leaseMs: 60_000 });
    await w.runOnce(WS_A, CONFIGS);
    let job = await store.getById(WS_A, jobId);
    expect(job?.status).toBe('queued');
    expect(job?.attempts).toBe(1);
    expect(job?.uncertainRowIds).toEqual([]); // nothing was ever submitted
    expect(job?.startedRowId).toBeNull();
    await w.runOnce(WS_A, CONFIGS);
    await w.runOnce(WS_A, CONFIGS);
    job = await store.getById(WS_A, jobId);
    expect(job?.status).toBe('failed');
    expect(job?.attempts).toBe(3);
    expect(job?.uncertainRowIds).toEqual([]);
  });

  it('claim-loss fencing: a worker that loses the claim mid-job writes no more cells and no terminal state', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const { jobId } = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest() });
    let sinkWrites = 0;
    const sink = { write: async () => { sinkWrites++; } };
    const rows = gridRows();
    const w1 = new WaterfallDispatchWorker(store, makeRunner(), rows, sink, undefined, [], 'worker-1');
    // Simulate: after row 1 completes, another holder takes the claim (recovery).
    const origCompleted = store.markRowCompleted.bind(store);
    store.markRowCompleted = async (id, workerId, rowId) => {
      await origCompleted(id, workerId, rowId);
      await pg.query(`UPDATE enrichment_jobs SET claimed_by='worker-2' WHERE id=$1`, [id]);
    };
    await w1.runOnce(WS_A, CONFIGS);
    expect(sinkWrites).toBe(1); // row 2's cell write was fenced off
    const job = await store.getById(WS_A, jobId);
    expect(job?.claimedBy).toBe('worker-2'); // worker-1 wrote no terminal state
    expect(job?.status).toBe('running');
  });

  it('newer-result guard covers edits after ENQUEUE but before claim', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest([ROW_1]) });
    // User edits the cell AFTER dispatching, BEFORE any worker claims the job.
    await pg.query(`INSERT INTO cells (row_id, column_id, value, updated_at) VALUES ($1,$2,'"edited-after-dispatch"', now() + interval '1 second') ON CONFLICT (row_id, column_id) DO UPDATE SET value='"edited-after-dispatch"', updated_at=now() + interval '1 second'`, [ROW_1, COL]);
    // Fixture clock is millisecond-grained; the offset makes "after enqueue" unambiguous.
    const job = (await store.claimNextQueued(WS_A, 'w1'))!;
    const sink = gridSink();
    await sink.write(job, ROW_1, payloadOf('stale-result'));
    const cell = await pg.query(`SELECT value FROM cells WHERE row_id=$1 AND column_id=$2`, [ROW_1, COL]);
    expect((cell.rows[0] as any).value).toBe('edited-after-dispatch'); // user edit wins
  });

  it('uncertain outcome is explicit and NEVER auto-retried: a started-but-uncompleted row goes to needs_review, preserving a possible prior charge', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    const { jobId } = await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest([ROW_1]) });
    const claim = await store.claimNextQueued(WS_A, 'worker-dead');
    await store.markRowStarted(claim!.id, 'worker-dead', ROW_1); // dies mid-row: provider outcome unknown, possibly charged
    await store.requeueInterrupted(WS_A, new Date(Date.now() + 1000)); // stale: requeued
    const ran: string[] = [];
    const w = new WaterfallDispatchWorker(store, makeRunner(async (input) => { ran.push(input.domain); return payloadOf('ok'); }),
      gridRows(), gridSink(), undefined, [], 'worker-new');
    await w.runOnce(WS_A, CONFIGS);
    expect(ran).toEqual([]); // NOT re-run: no blind double-charge
    const job = await store.getById(WS_A, jobId);
    expect(job?.status).toBe('needs_review');
    expect(job?.uncertainRowIds).toEqual([ROW_1]);
    expect(job?.error).toMatch(/uncertain/);
    // A needs_review job is not picked up by the ordinary claim loop.
    expect(await w.runOnce(WS_A, CONFIGS)).toBeNull();
  });

  it('lease/fencing: recovery takes ONLY stale claims - a fresh-heartbeat job (live worker) is never stolen; fenced terminal writes are no-ops', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest([ROW_1]) });
    await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest([ROW_2]) });
    const live = await store.claimNextQueued(WS_A, 'live-worker'); // fresh heartbeat
    const stale = await store.claimNextQueued(WS_A, 'dead-worker');
    await pg.query(`UPDATE enrichment_jobs SET heartbeat_at = now() - interval '10 minutes' WHERE id=$1`, [stale!.id]);
    const recovered = await store.requeueInterrupted(WS_A, new Date(Date.now() - 60_000));
    expect(recovered).toBe(1); // only the stale one
    expect((await store.getById(WS_A, stale!.id))?.status).toBe('queued');
    expect((await store.getById(WS_A, live!.id))?.status).toBe('running'); // untouched
    // Fencing: a terminal write from a non-holder is refused.
    expect(await store.markSucceeded(live!.id, 'someone-else')).toBe(false);
    expect((await store.getById(WS_A, live!.id))?.status).toBe('running');
    expect(await store.markSucceeded(live!.id, 'live-worker')).toBe(true);
  });

  it('newer-result guard: a replayed write never overwrites a cell updated after the claim lease', async () => {
    const queue = new DurableWaterfallDispatchQueue(store);
    await queue.enqueue({ workspaceId: WS_A, request: dispatchRequest([ROW_1]) });
    const job = (await store.claimNextQueued(WS_A, 'w1'))!;
    // A newer value lands in the target cell (later edit/dispatch) after the claim.
    await pg.query(`INSERT INTO cells (row_id, column_id, value, updated_at) VALUES ($1,$2,'"manual-newer"', now() + interval '1 hour') ON CONFLICT (row_id, column_id) DO UPDATE SET value='"manual-newer"', updated_at = now() + interval '1 hour'`, [ROW_1, COL]);
    const sink = gridSink();
    await sink.write(job, ROW_1, payloadOf('stale-result'));
    const cell = await pg.query(`SELECT value FROM cells WHERE row_id=$1 AND column_id=$2`, [ROW_1, COL]);
    expect((cell.rows[0] as any).value).toBe('manual-newer'); // unchanged
  });

  it('row source: resolves the domain via config.sourceColumnId; without the convention it fails loudly, never guesses', async () => {
    const rows = gridRows();
    const job = { workspaceId: WS_A, columnId: COL } as EnrichmentJobRow;
    await expect(rows.resolve(job, ROW_1)).resolves.toEqual({ domain: 'northstar.example', workspaceId: WS_A });
    const noConvention = { workspaceId: WS_A, columnId: SRC_COL } as EnrichmentJobRow; // text column, no sourceColumnId
    await expect(rows.resolve(noConvention, ROW_1)).rejects.toThrow(/sourceColumnId/);
  });

  it('node-config resolver: reads config.nodes; absent or malformed config fails loudly, never guesses providers', async () => {
    const NODES_COL = crypto.randomUUID();
    const BAD_COL = crypto.randomUUID();
    await pg.query(`INSERT INTO columns (id, table_id, type, config) VALUES ($1,$2,'waterfall',$3),($4,$2,'waterfall',$5)`, [
      NODES_COL, TBL,
      JSON.stringify({ sourceColumnId: SRC_COL, nodes: [{ id: 'n1', provider: 'apollo', tier: 1 }, { id: 'n2', provider: 'hunter', tier: 2, costWeight: 3 }] }),
      BAD_COL,
      JSON.stringify({ nodes: [{ id: 'n1', provider: 'not-a-provider', tier: 1 }] }),
    ]);
    const resolver = new GridNodeConfigResolver(sqlGridAccess(pgliteExec(pg)));
    const job = { workspaceId: WS_A, columnId: NODES_COL } as EnrichmentJobRow;
    await expect(resolver.resolve(job)).resolves.toEqual([
      { id: 'n1', provider: 'apollo', tier: 1 },
      { id: 'n2', provider: 'hunter', tier: 2, costWeight: 3 },
    ]);
    const noNodes = { workspaceId: WS_A, columnId: COL } as EnrichmentJobRow; // waterfall column without config.nodes
    await expect(resolver.resolve(noNodes)).rejects.toThrow(/config\.nodes/);
    await expect(resolver.resolve({ workspaceId: WS_A, columnId: BAD_COL } as EnrichmentJobRow)).rejects.toThrow(/malformed/);
    await expect(resolver.resolve({ workspaceId: WS_B, columnId: NODES_COL } as EnrichmentJobRow)).rejects.toThrow(/not found/);
  });

  it('worker with the resolver runs a job end-to-end from column config.nodes (no caller-supplied configs)', async () => {
    const NODES_COL = crypto.randomUUID();
    await pg.query(`INSERT INTO columns (id, table_id, type, config) VALUES ($1,$2,'waterfall',$3)`, [
      NODES_COL, TBL,
      JSON.stringify({ sourceColumnId: SRC_COL, nodes: [{ id: 'n1', provider: 'apollo', tier: 1 }] }),
    ]);
    const resolver = new GridNodeConfigResolver(sqlGridAccess(pgliteExec(pg)));
    const svc = new WaterfallService(undefined, undefined, new DurableWaterfallDispatchQueue(store));
    const res = await svc.dispatchWaterfall({ ...dispatchRequest(), columnId: NODES_COL }, WS_A);
    const w = new WaterfallDispatchWorker(store, makeRunner(), gridRows(), gridSink(), undefined, [], 'w-resolver', (job) => resolver.resolve(job));
    await w.runQueued(WS_A);
    const done = await svc.getJobStatus(WS_A, res.jobId);
    expect(done).toMatchObject({ status: 'succeeded', completedCount: 2 });
  });

  it('job status read model: honest progress from the store, tenant-fenced, unavailable without a mounted queue reader', async () => {
    const svc = new WaterfallService(undefined, undefined, new DurableWaterfallDispatchQueue(store));
    const res = await svc.dispatchWaterfall(dispatchRequest(), WS_A);
    const queued = await svc.getJobStatus(WS_A, res.jobId);
    expect(queued).toMatchObject({ jobId: res.jobId, status: 'queued', totalQueued: 2, completedCount: 0, uncertainCount: 0, attempts: 0, error: null });
    const w = new WaterfallDispatchWorker(store, makeRunner(), gridRows(), gridSink());
    await w.runQueued(WS_A, CONFIGS);
    const done = await svc.getJobStatus(WS_A, res.jobId);
    expect(done).toMatchObject({ status: 'succeeded', completedCount: 2 });
    // Tenant fence: another workspace gets NotFound, never the job.
    await expect(svc.getJobStatus(WS_B, res.jobId)).rejects.toThrow(/not found/i);
    // No store mounted: the same honest unavailable posture as dispatch, never a fabricated status.
    await expect(new WaterfallService().getJobStatus(WS_A, res.jobId)).rejects.toThrow(/not implemented/i);
  });

  it('WaterfallService with the durable queue returns a REAL job id; without it the honest 503 posture stands; entitlements refuse BEFORE enqueue', async () => {
    const svc = new WaterfallService(undefined, undefined, new DurableWaterfallDispatchQueue(store));
    const res = await svc.dispatchWaterfall(dispatchRequest(), WS_A);
    expect(res.jobId).not.toMatch(/^job-/);
    const job = await store.getById(WS_A, res.jobId);
    expect(job?.status).toBe('queued');
    await expect(new WaterfallService().dispatchWaterfall(dispatchRequest(), WS_A)).rejects.toThrow(/not implemented/i);
    const denying = {
      checkFeature: async () => ({ allowed: true }) as any,
      checkLimit: async () => ({ allowed: false, reason: 'Enrichment credits exhausted (fixture decision)' }) as any,
    };
    const svc2 = new WaterfallService(denying, undefined, new DurableWaterfallDispatchQueue(store));
    await expect(svc2.dispatchWaterfall(dispatchRequest(), WS_A)).rejects.toThrow(/credit limit/i);
    expect((await store.listByWorkspace(WS_A)).filter((j) => j.id !== res.jobId)).toEqual([]);
  });

  it('listWorkspacesWithJobs: distinct workspaces filtered by status, driving the poll loop and recovery', async () => {
    const svc = new WaterfallService(undefined, undefined, new DurableWaterfallDispatchQueue(store));
    await svc.dispatchWaterfall(dispatchRequest(), WS_A);
    await svc.dispatchWaterfall(dispatchRequest(), WS_A); // idempotent retry: same job, still one
    await svc.dispatchWaterfall({ ...dispatchRequest(), rowIds: [crypto.randomUUID()] }, WS_A);
    await svc.dispatchWaterfall(dispatchRequest(), WS_B);
    expect((await store.listWorkspacesWithJobs(['queued'])).sort()).toEqual([WS_A, WS_B].sort());
    // Claim WS_A's oldest job: WS_A still has `second` queued, WS_B untouched.
    const claimed = await store.claimNextQueued(WS_A, 'w-loop');
    expect(claimed).not.toBeNull();
    expect((await store.listWorkspacesWithJobs(['running'])).sort()).toEqual([WS_A]);
    expect((await store.listWorkspacesWithJobs(['queued'])).sort()).toEqual([WS_A, WS_B].sort());
    // Finish everything: no workspace reports either status.
    await store.markFailed(claimed!.id, 'w-loop', 'done', { requeue: false });
    const w = new WaterfallDispatchWorker(store, makeRunner(), gridRows(), gridSink());
    await w.runQueued(WS_A, CONFIGS);
    await w.runQueued(WS_B, CONFIGS);
    expect(await store.listWorkspacesWithJobs(['queued'])).toEqual([]);
    expect(await store.listWorkspacesWithJobs(['running'])).toEqual([]);
  });
});
