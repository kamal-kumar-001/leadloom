import { DurableWaterfallDispatchQueue, WaterfallDispatchWorker, type EnrichmentJobsStore } from './dispatch-queue';
import { sqlEnrichmentJobsStore, prismaExecutor, type SqlExecutor } from './sql-enrichment-jobs-store';
import { sqlGridAccess, GridDispatchRowSource, GridDispatchResultSink, GridNodeConfigResolver } from './grid-dispatch.ports';
import type { DAGRunnerService } from './dag-runner.service';

/**
 * D2 default-off assembly: builds the durable dispatch queue + a bounded
 * poll loop around the worker. NOTHING here runs unless a host mounts it
 * (main.ts wiring behind LEADLOOM_WATERFALL_DURABLE_DISPATCH, itself gated
 * on the proposed migration AND a startup schema-readiness probe - a host
 * without the enrichment_jobs table keeps the unavailable posture instead
 * of running a loop that can only fail). One loop instance per deployment:
 * the same single-worker posture the worker documents until FOR UPDATE
 * SKIP LOCKED claim safety is production-proved.
 *
 * Loop honesty:
 * - Ticks never overlap; a slow tick skips the next interval rather than
 *   stacking concurrent claims.
 * - start() runs crash recovery ONCE over workspaces with 'running' jobs
 *   (stale leases only; fresh heartbeats belong to live workers).
 * - A tick error is reported and the loop continues; stop() leaves an
 *   in-flight tick to finish (no mid-provider kill).
 */
export interface DurableDispatchDeps {
  store: EnrichmentJobsStore;
  worker: WaterfallDispatchWorker;
  /** Default 5s. Tests inject a small value. */
  pollIntervalMs?: number;
  /** Mount decides logging. Defaults to console.error. */
  onError?: (err: unknown) => void;
}

export interface DurableWaterfallDispatch {
  queue: DurableWaterfallDispatchQueue;
  isRunning(): boolean;
  start(): void;
  stop(): void;
}

export function buildDurableWaterfallDispatch(deps: DurableDispatchDeps): DurableWaterfallDispatch {
  const queue = new DurableWaterfallDispatchQueue(deps.store);
  const interval = deps.pollIntervalMs ?? 5_000;
  const onError = deps.onError ?? ((err: unknown) => console.error('[waterfall-dispatch]', err));
  let timer: ReturnType<typeof setInterval> | null = null;
  let ticking = false;

  const tick = async (): Promise<void> => {
    if (ticking) return; // never overlap ticks: one worker, one claim at a time
    ticking = true;
    try {
      const workspaces = await deps.store.listWorkspacesWithJobs(['queued']);
      for (const workspaceId of workspaces) {
        await deps.worker.runQueued(workspaceId);
      }
    } catch (err) {
      onError(err);
    } finally {
      ticking = false;
    }
  };

  return {
    queue,
    isRunning: () => timer !== null,
    start() {
      if (timer) return; // idempotent
      timer = setInterval(() => {
        void tick();
      }, interval);
      // Crash recovery once at start, then the first poll. Recovery failure
      // must not prevent the loop from serving new dispatches.
      void (async () => {
        try {
          const stale = await deps.store.listWorkspacesWithJobs(['running']);
          for (const workspaceId of stale) {
            await deps.worker.recoverOnStart(workspaceId);
          }
        } catch (err) {
          onError(err);
        }
        await tick();
      })();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      // A tick already in flight finishes on its own: killing it mid-provider
      // would create exactly the uncertain-row state the worker exists to avoid.
    },
  };
}

/**
 * Startup schema-readiness probe: the durable path needs the PROPOSED
 * enrichment_jobs table (docs/plan/proposed/D2_enrichment_jobs.sql). The
 * probe only READS information_schema; it never applies schema - migration
 * application is a gated host action, and a missing table means the mount
 * stays OFF rather than starting a loop that can only fail.
 */
export const DURABLE_DISPATCH_REQUIRED_TABLES = ['enrichment_jobs'] as const;

export async function probeDurableDispatchReadiness(
  exec: SqlExecutor,
): Promise<{ ready: boolean; missing: string[] }> {
  const rows = await exec.query<{ name: string }>(
    `SELECT table_name AS "name" FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`,
    [[...DURABLE_DISPATCH_REQUIRED_TABLES]],
  );
  const present = new Set(rows.map((r) => r.name));
  const missing = DURABLE_DISPATCH_REQUIRED_TABLES.filter((t) => !present.has(t));
  return { ready: missing.length === 0, missing };
}

export interface MountDurableDispatchDeps {
  env: { LEADLOOM_WATERFALL_DURABLE_DISPATCH?: string };
  /** Prisma client (or compatible) when a database is connected; null/undefined without one. */
  prisma: { $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T> } | null | undefined;
  /** The waterfall service's runner (provider adapters already registered). */
  runner: DAGRunnerService;
  pollIntervalMs?: number;
  onError?: (err: unknown) => void;
  /** Mount decides logging; defaults to console.error. */
  log?: (msg: string) => void;
}

/**
 * main.ts seam for the default-off mount. Returns null - and changes
 * nothing - unless ALL of: LEADLOOM_WATERFALL_DURABLE_DISPATCH='true', a
 * database is connected, AND the schema-readiness probe finds the proposed
 * table. Flag on without a database, or with the table missing, logs loudly
 * and keeps the honest unavailable posture (dispatch still 503s, nothing is
 * queued, no loop starts, nothing is retried, no schema is applied). A
 * probe failure (connectivity) is treated as not-ready. No provider contact
 * happens here; per-row execution stays inside the worker under its
 * documented policies.
 */
export async function mountDurableWaterfallDispatch(deps: MountDurableDispatchDeps): Promise<DurableWaterfallDispatch | null> {
  const log = deps.log ?? ((msg: string) => console.error(msg));
  if (deps.env.LEADLOOM_WATERFALL_DURABLE_DISPATCH !== 'true') return null;
  if (!deps.prisma) {
    log('[waterfall-dispatch] LEADLOOM_WATERFALL_DURABLE_DISPATCH=true but no database is connected: durable dispatch stays OFF; dispatch keeps the unavailable posture and nothing is queued.');
    return null;
  }
  const exec = prismaExecutor(deps.prisma);
  let readiness: { ready: boolean; missing: string[] };
  try {
    readiness = await probeDurableDispatchReadiness(exec);
  } catch (err) {
    log(`[waterfall-dispatch] schema-readiness probe failed (${err instanceof Error ? err.message : 'unknown'}): durable dispatch stays OFF.`);
    return null;
  }
  if (!readiness.ready) {
    log(`[waterfall-dispatch] proposed table(s) missing (${readiness.missing.join(', ')}): durable dispatch stays OFF and the loop is NOT started. Schema application is a gated host action - nothing was applied or retried.`);
    return null;
  }
  const store = sqlEnrichmentJobsStore(exec);
  const grid = sqlGridAccess(exec);
  const resolver = new GridNodeConfigResolver(grid);
  const worker = new WaterfallDispatchWorker(
    store,
    deps.runner,
    new GridDispatchRowSource(grid),
    new GridDispatchResultSink(grid),
    undefined,
    [],
    undefined,
    (job) => resolver.resolve(job),
  );
  const dispatch = buildDurableWaterfallDispatch({
    store,
    worker,
    pollIntervalMs: deps.pollIntervalMs,
    onError: deps.onError,
  });
  dispatch.start();
  return dispatch;
}
