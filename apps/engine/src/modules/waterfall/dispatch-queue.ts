import { createHash } from 'node:crypto';
import type { DispatchWaterfallRequest } from '@leadloom/contracts';
import type { WaterfallDispatchQueue } from './waterfall.service';
import type { DAGRunnerService, WaterfallNodeConfig } from './dag-runner.service';
import type { ProviderExecutionInput } from './adapters/base-provider.adapter';
import type { WaterfallCellPayload } from '@leadloom/contracts';

/**
 * D2 durable dispatch: local implementation of the persistence adapter and
 * queue worker from docs/plan/proposed/D2_DISPATCH_PERSISTENCE.md.
 *
 * Boundaries (main, 2026-11-20): production migration application, worker
 * activation and provider calls stay OFF. Nothing here is mounted in main.ts;
 * WaterfallService without an injected queue keeps answering 503
 * queued:false. Production acceptance is UNPROVED - the store is exercised
 * only against an isolated disposable PGlite fixture.
 *
 * Design amendments recorded in the proposal doc: `attempts`,
 * `completed_row_ids`, `started_row_id`, `claimed_by`, `heartbeat_at` columns
 * added to the PROPOSED schema - bounded restart-safe retry needs a persisted
 * attempt count, and honest recovery needs per-row checkpoints, an explicit
 * uncertain-outcome record, and lease/fencing so recovery cannot steal a live
 * worker's claim. Semantics are AT-LEAST-ONCE per row narrowed by
 * checkpoints; exactly-once is NOT claimed and production concurrency
 * (FOR UPDATE SKIP LOCKED) stays UNPROVED.
 */

export type EnrichmentJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_review';

export interface EnrichmentJobRow {
  id: string;
  workspaceId: string;
  columnId: string;
  status: EnrichmentJobStatus;
  rowIds: string[];
  totalQueued: number;
  idempotencyKey: string;
  attempts: number;
  /** Per-row completion checkpoints: rows already written to the sink.
   *  Replay after a crash skips them, so a partial run never re-runs
   *  completed rows (no repeat provider charge, no newer-result overwrite). */
  completedRowIds: string[];
  /** Row the worker was mid-flight on when last checkpointed. A value here
   *  that is NOT in completedRowIds is the explicit UNCERTAIN outcome: the
   *  provider call may or may not have landed (and been CHARGED). */
  startedRowId: string | null;
  /** Rows whose provider outcome is unknown. Never auto-retried: no provider
   *  documents idempotent enrichment, so a blind retry may double-charge.
   *  Surfaced via status 'needs_review'; retry needs explicit operator action
   *  (or documented provider idempotency covering that exact call). */
  uncertainRowIds: string[];
  /** Fencing token: the worker instance holding the claim. */
  claimedBy: string | null;
  /** Lease heartbeat, refreshed per row while the claim is held. */
  heartbeatAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewEnrichmentJob {
  id: string;
  workspaceId: string;
  columnId: string;
  rowIds: string[];
  idempotencyKey: string;
}

/**
 * Storage surface the queue and worker need. One implementation wraps a
 * Prisma delegate (production, once the model exists - UNPROVED); the PGlite
 * fixture implementation lives in the spec. Every read and claim is
 * tenant-fenced by workspaceId.
 */
export interface EnrichmentJobsStore {
  /** Insert; on (workspaceId, idempotencyKey) conflict return the existing row. Never throws on duplicate. */
  insertIdempotent(job: NewEnrichmentJob): Promise<{ row: EnrichmentJobRow; created: boolean }>;
  getById(workspaceId: string, id: string): Promise<EnrichmentJobRow | null>;
  listByWorkspace(workspaceId: string): Promise<EnrichmentJobRow[]>;
  /** Atomic queued -> running claim of the oldest queued job for the workspace.
   *  Stamps claimed_by + heartbeat_at with the claiming worker. Null when none. */
  claimNextQueued(workspaceId: string, workerId: string): Promise<EnrichmentJobRow | null>;
  /** Refresh the lease heartbeat; only the claim holder may refresh. */
  heartbeat(id: string, workerId: string): Promise<void>;
  /** Checkpoint: record the row now in-flight (uncertain until completed). */
  markRowStarted(id: string, workerId: string, rowId: string): Promise<void>;
  /** Checkpoint: record the row durably written to the sink. */
  markRowCompleted(id: string, workerId: string, rowId: string): Promise<void>;
  /** Terminal success. Fenced: no-op (returns false) unless workerId still holds the claim. */
  markSucceeded(id: string, workerId: string): Promise<boolean>;
  /** Record a failure, fenced like markSucceeded. requeue=true puts the job back to queued (attempts+1). */
  markFailed(id: string, workerId: string, error: string, opts: { requeue: boolean }): Promise<boolean>;
  /** Move the in-flight row into the uncertain set and clear started_row_id. Fenced. */
  markRowUncertain(id: string, workerId: string, rowId: string): Promise<void>;
  /** Clear started_row_id when the worker KNOWS the in-flight row failed
   *  (executeRow threw - a caught error is a known failure, retryable under
   *  the bounded policy; only an uncaught process death leaves the row
   *  uncertain). Fenced. */
  clearRowStarted(id: string, workerId: string): Promise<void>;
  /** Terminal needs_review (uncertain rows remain after all others finished). Fenced. */
  markNeedsReview(id: string, workerId: string, error: string): Promise<boolean>;
  /** Crash recovery: running -> queued ONLY for jobs whose lease heartbeat is
   *  older than staleBefore. A fresh heartbeat means a live worker holds the
   *  claim; requeueing it would steal the claim and double-run rows. */
  requeueInterrupted(workspaceId: string, staleBefore: Date): Promise<number>;
  /** Distinct workspaces holding at least one job in any of the given
   *  statuses (e.g. ['queued'] for the poll loop, ['running'] for crash
   *  recovery). Claims and recovery stay workspace-scoped. */
  listWorkspacesWithJobs(statuses: string[]): Promise<string[]>;
}

/** Retry-safe dispatch identity: same workspace + column + row set retried = same job. */
export function idempotencyKeyFor(workspaceId: string, request: DispatchWaterfallRequest): string {
  const sorted = [...request.rowIds].sort();
  return createHash('sha256')
    .update(`${workspaceId}|${request.columnId}|${sorted.join(',')}`)
    .digest('hex')
    .slice(0, 48);
}

export class DurableWaterfallDispatchQueue implements WaterfallDispatchQueue {
  constructor(private readonly store: EnrichmentJobsStore) {}

  async enqueue(input: { workspaceId?: string; request: DispatchWaterfallRequest }): Promise<{ jobId: string }> {
    if (!input.workspaceId) throw new Error('workspaceId is required for durable dispatch');
    const key = idempotencyKeyFor(input.workspaceId, input.request);
    const { row } = await this.store.insertIdempotent({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      columnId: input.request.columnId,
      rowIds: input.request.rowIds,
      idempotencyKey: key,
    });
    // A retried identical dispatch returns the EXISTING job id - never a duplicate.
    return { jobId: row.id };
  }

  /** D3 status read; tenant-fenced by the store. */
  async getJob(workspaceId: string, jobId: string) {
    return this.store.getById(workspaceId, jobId);
  }
}

/** Where finished per-row results go. Injected: the cells-table write path is
 *  grid territory and NOT part of this adapter; tests use a recording sink. */
export interface DispatchResultSink {
  write(job: EnrichmentJobRow, rowId: string, payload: WaterfallCellPayload): Promise<void>;
}

/** Resolves a persisted row id into runner input (domain etc.). Grid rows are
 *  not this adapter's data; injected. Tests use a static map. */
export interface DispatchRowSource {
  resolve(job: EnrichmentJobRow, rowId: string): Promise<ProviderExecutionInput>;
}

export interface DispatchWorkerPolicy {
  /** Max attempts before a job is terminally failed. Default 3 (initial + 2 retries). */
  maxAttempts: number;
  /** Claim lease length in ms; heartbeats refresh PER ROW, so this MUST exceed
   *  the slowest single-row execution (all provider steps for one row), not
   *  just the idle gap between rows. Default 60_000. */
  leaseMs: number;
}

export const DEFAULT_DISPATCH_WORKER_POLICY: DispatchWorkerPolicy = { maxAttempts: 3, leaseMs: 60_000 };

/** Thrown when the worker discovers mid-job that another holder owns the claim. */
export class WaterfallClaimLostError extends Error {
  constructor(jobId: string) {
    super(`claim lost for job ${jobId}`);
    this.name = 'WaterfallClaimLostError';
  }
}

/**
 * DB-native claim loop. Divergence from the proposal's "BullMQ later" noted
 * in the design doc: claiming straight off enrichment_jobs needs no Redis
 * (itself an undecided item); BullMQ remains a later option, not a
 * requirement. Concurrency is deliberately one job at a time per worker
 * instance (4GB VPS budget); multi-replica claiming safety on real Postgres
 * (FOR UPDATE SKIP LOCKED) is a production-acceptance item, UNPROVED here.
 */
export class WaterfallDispatchWorker {
  /** Fencing token for this instance. */
  readonly workerId: string;

  constructor(
    private readonly store: EnrichmentJobsStore,
    private readonly runner: DAGRunnerService,
    private readonly rows: DispatchRowSource,
    private readonly sink: DispatchResultSink,
    private readonly policy: DispatchWorkerPolicy = DEFAULT_DISPATCH_WORKER_POLICY,
    /** Used when runOnce/runQueued are called without explicit configs. */
    private readonly defaultNodeConfigs: WaterfallNodeConfig[] = [],
    workerId?: string,
    /** Per-job config resolution (e.g. from the waterfall column's config).
     *  Used when the caller passes no explicit configs; throws loud. */
    private readonly resolveNodeConfigs?: (job: EnrichmentJobRow) => Promise<WaterfallNodeConfig[]>,
  ) {
    this.workerId = workerId ?? crypto.randomUUID();
  }

  /** Recover jobs whose lease expired (dead holder). Call once at worker start.
   *  Jobs with a fresh heartbeat belong to a LIVE worker and are never taken. */
  async recoverOnStart(workspaceId: string, now: Date = new Date()): Promise<number> {
    return this.store.requeueInterrupted(workspaceId, new Date(now.getTime() - this.policy.leaseMs));
  }

  /**
   * Claim and execute at most one queued job. Returns the job id processed, or null when idle.
   *
   * Recovery semantics (main, 2026-11-20): AT-LEAST-ONCE per row, narrowed by
   * checkpoints - NOT exactly-once, no production-concurrency claim.
   *  - Rows in completedRowIds are skipped on replay: a partial run never
   *    re-runs them (no repeat provider charge, no overwriting newer cells).
   *  - A row that is startedRowId but not completed is the explicit UNCERTAIN
   *    outcome: it is re-run. The 30-day domain cache inside DAGRunnerService
   *    absorbs a provider step that already succeeded, which narrows - does
   *    not eliminate - duplicate provider spend on this one row.
   *  - Terminal writes are fenced by claimedBy; losing the fence (a recovered
   *    job reclaimed elsewhere) stops this worker from touching the job.
   *  - Deployment guard: ONE worker instance per deployment is the supported
   *    posture until FOR UPDATE SKIP LOCKED claim safety is production-proved.
   */
  async runOnce(workspaceId: string, nodeConfigs?: WaterfallNodeConfig[]): Promise<string | null> {
    const job = await this.store.claimNextQueued(workspaceId, this.workerId);
    if (!job) return null;
    const completed = new Set(job.completedRowIds);
    const uncertain = new Set(job.uncertainRowIds);
    let currentRowId: string | null = null; // set only while a provider request may be in flight
    try {
      const configs = nodeConfigs ?? (this.resolveNodeConfigs ? await this.resolveNodeConfigs(job) : this.defaultNodeConfigs);
      // Fold a leftover in-flight row into the uncertain set (its worker died
      // mid-provider-stage). NEVER auto-retried: the provider call may already
      // have been charged, no provider documents idempotent enrichment, and a
      // domain-cache hit would NOT prove the original call was free.
      if (job.startedRowId && !completed.has(job.startedRowId)) {
        await this.store.markRowUncertain(job.id, this.workerId, job.startedRowId);
        uncertain.add(job.startedRowId);
      }
      for (const rowId of job.rowIds) {
        if (completed.has(rowId) || uncertain.has(rowId)) continue;
        await this.store.heartbeat(job.id, this.workerId);
        // STAGE 1 - pre-submission: a failure here PROVES no provider request
        // was made (nothing charged) -> known failure, ordinary bounded retry.
        const input = await this.rows.resolve(job, rowId);
        // STAGE 2 - submitted: from this point a provider request may have
        // been sent and charged. Any failure (executeRow throw - timeout,
        // connection reset, parse failure; or a sink write failure after the
        // provider completed) leaves the outcome UNKNOWN -> the row goes to
        // the uncertain set, never blind-retried. A RETURNED error-status
        // payload is a completed waterfall with known per-provider outcomes;
        // it is written to the sink as the row's honest result.
        currentRowId = rowId;
        await this.store.markRowStarted(job.id, this.workerId, rowId);
        const payload = await this.runner.executeRow(input, configs);
        // Fence the cell write: re-read the claim holder immediately before
        // touching cells. Narrows - does not eliminate - the write race; a
        // transactional DB-level fence is a production-acceptance item.
        const current = await this.store.getById(workspaceId, job.id);
        if (current?.claimedBy !== this.workerId) throw new WaterfallClaimLostError(job.id);
        await this.sink.write(job, rowId, payload);
        await this.store.markRowCompleted(job.id, this.workerId, rowId);
        currentRowId = null;
      }
      if (uncertain.size > 0) {
        await this.store.markNeedsReview(
          job.id, this.workerId,
          `${uncertain.size} row(s) have an uncertain provider outcome; review required - not auto-retried (possible prior charge)`,
        );
      } else {
        await this.store.markSucceeded(job.id, this.workerId);
      }
    } catch (err) {
      if (err instanceof WaterfallClaimLostError) return job.id; // new holder owns the job; write nothing
      const message = err instanceof Error ? err.message : 'unknown worker error';
      const attemptsSoFar = job.attempts + 1;
      // Classify by STAGE, not by caught-vs-process-death (main, 2026-11-20):
      // - currentRowId === null: the failure happened BEFORE any provider
      //   request was submitted (row resolution etc.) - provably uncharged,
      //   a known failure; clear the in-flight record and retry under the
      //   bounded policy.
      // - currentRowId !== null: a provider request may have been submitted
      //   and charged (timeout, connection reset, parse failure, or a sink
      //   failure after the provider completed). The outcome is UNKNOWN:
      //   move the row to the uncertain set - it is never blind-retried and
      //   the job ends needs_review.
      if (currentRowId) {
        await this.store.markRowUncertain(job.id, this.workerId, currentRowId);
      } else {
        await this.store.clearRowStarted(job.id, this.workerId);
      }
      await this.store.markFailed(job.id, this.workerId, message, { requeue: attemptsSoFar < this.policy.maxAttempts });
    }
    return job.id;
  }

  /** Drain queued jobs for the workspace, one at a time. Returns processed job ids. */
  async runQueued(workspaceId: string, nodeConfigs?: WaterfallNodeConfig[]): Promise<string[]> {
    const done: string[] = [];
    for (;;) {
      const id = await this.runOnce(workspaceId, nodeConfigs);
      if (!id) break;
      done.push(id);
    }
    return done;
  }
}
