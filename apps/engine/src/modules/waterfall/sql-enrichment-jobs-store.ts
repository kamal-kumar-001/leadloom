import type { EnrichmentJobRow, EnrichmentJobsStore, NewEnrichmentJob } from './dispatch-queue';

/**
 * D2 production store path: the EnrichmentJobsStore SQL over a minimal
 * executor, so the SAME statements are exercised by the isolated PGlite
 * fixture suite (dispatch-queue-db.spec.ts) and by the Prisma adapter below.
 * The table comes from the PROPOSED migration (docs/plan/proposed/
 * D2_enrichment_jobs.sql) - deliberately not applied anywhere yet - so this
 * store is inert until that gated migration runs on a host.
 *
 * Prisma note: prismaExecutor is a thin adapter over $queryRawUnsafe. It is
 * NOT locally testable without booting a database (gated), which is exactly
 * why the SQL lives behind SqlExecutor: the fixture suite proves statement
 * semantics, and the adapter adds only parameter passing.
 */
export interface SqlExecutor {
  query<T = unknown>(sql: string, params: unknown[]): Promise<T[]>;
}

/** Prisma $queryRawUnsafe adapts in one line; typed rows come back as plain objects. */
export function prismaExecutor(prisma: {
  $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T>;
}): SqlExecutor {
  return {
    query: async <T = unknown>(sql: string, params: unknown[]) =>
      (await prisma.$queryRawUnsafe<T[]>(sql, ...params)) as T[],
  };
}

export const ENRICHMENT_JOB_ROW_SEL = `id, workspace_id AS "workspaceId", column_id AS "columnId", status, row_ids AS "rowIds", total_queued AS "totalQueued", idempotency_key AS "idempotencyKey", attempts, completed_row_ids AS "completedRowIds", started_row_id AS "startedRowId", uncertain_row_ids AS "uncertainRowIds", claimed_by AS "claimedBy", heartbeat_at AS "heartbeatAt", error, created_at AS "createdAt", updated_at AS "updatedAt"`;

export function sqlEnrichmentJobsStore(exec: SqlExecutor): EnrichmentJobsStore {
  const SEL = ENRICHMENT_JOB_ROW_SEL;
  return {
    async insertIdempotent(job: NewEnrichmentJob) {
      const ins = await exec.query<EnrichmentJobRow>(
        `INSERT INTO enrichment_jobs (id, workspace_id, column_id, row_ids, total_queued, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (workspace_id, idempotency_key) DO NOTHING RETURNING ${SEL}`,
        [job.id, job.workspaceId, job.columnId, job.rowIds, job.rowIds.length, job.idempotencyKey]);
      if (ins[0]) return { row: ins[0], created: true };
      const existing = await exec.query<EnrichmentJobRow>(
        `SELECT ${SEL} FROM enrichment_jobs WHERE workspace_id=$1 AND idempotency_key=$2`,
        [job.workspaceId, job.idempotencyKey]);
      return { row: existing[0], created: false };
    },
    async getById(workspaceId, id) {
      const rows = await exec.query<EnrichmentJobRow>(`SELECT ${SEL} FROM enrichment_jobs WHERE workspace_id=$1 AND id=$2`, [workspaceId, id]);
      return rows[0] ?? null;
    },
    async listByWorkspace(workspaceId) {
      return exec.query<EnrichmentJobRow>(`SELECT ${SEL} FROM enrichment_jobs WHERE workspace_id=$1 ORDER BY created_at`, [workspaceId]);
    },
    async claimNextQueued(workspaceId, workerId) {
      const rows = await exec.query<EnrichmentJobRow>(
        `UPDATE enrichment_jobs SET status='running', claimed_by=$2, heartbeat_at=now(), updated_at=now()
         WHERE id = (SELECT id FROM enrichment_jobs WHERE workspace_id=$1 AND status='queued' ORDER BY created_at LIMIT 1)
         RETURNING ${SEL}`, [workspaceId, workerId]);
      return rows[0] ?? null;
    },
    async heartbeat(id, workerId) {
      await exec.query(`UPDATE enrichment_jobs SET heartbeat_at=now() WHERE id=$1 AND claimed_by=$2`, [id, workerId]);
    },
    async markRowStarted(id, workerId, rowId) {
      await exec.query(`UPDATE enrichment_jobs SET started_row_id=$3, updated_at=now() WHERE id=$1 AND claimed_by=$2`, [id, workerId, rowId]);
    },
    async markRowCompleted(id, workerId, rowId) {
      await exec.query(
        `UPDATE enrichment_jobs SET completed_row_ids=array_append(completed_row_ids, $3), updated_at=now() WHERE id=$1 AND claimed_by=$2`,
        [id, workerId, rowId]);
    },
    async markSucceeded(id, workerId) {
      const rows = await exec.query<{ id: string }>(
        `UPDATE enrichment_jobs SET status='succeeded', updated_at=now() WHERE id=$1 AND claimed_by=$2 RETURNING id`, [id, workerId]);
      return rows.length === 1;
    },
    async markFailed(id, workerId, error, opts) {
      const rows = await exec.query<{ id: string }>(
        `UPDATE enrichment_jobs SET status=$3, attempts=attempts+1, error=$4, updated_at=now() WHERE id=$1 AND claimed_by=$2 RETURNING id`,
        [id, workerId, opts.requeue ? 'queued' : 'failed', error]);
      return rows.length === 1;
    },
    async clearRowStarted(id, workerId) {
      await exec.query(`UPDATE enrichment_jobs SET started_row_id=NULL, updated_at=now() WHERE id=$1 AND claimed_by=$2`, [id, workerId]);
    },
    async markRowUncertain(id, workerId, rowId) {
      await exec.query(
        `UPDATE enrichment_jobs SET uncertain_row_ids=array_append(uncertain_row_ids,$3), started_row_id=NULL, updated_at=now() WHERE id=$1 AND claimed_by=$2`,
        [id, workerId, rowId]);
    },
    async markNeedsReview(id, workerId, error) {
      const rows = await exec.query<{ id: string }>(
        `UPDATE enrichment_jobs SET status='needs_review', error=$3, updated_at=now() WHERE id=$1 AND claimed_by=$2 RETURNING id`,
        [id, workerId, error]);
      return rows.length === 1;
    },
    async requeueInterrupted(workspaceId, staleBefore) {
      const rows = await exec.query<{ id: string }>(
        `UPDATE enrichment_jobs SET status='queued', claimed_by=NULL, updated_at=now()
         WHERE workspace_id=$1 AND status='running' AND (heartbeat_at IS NULL OR heartbeat_at < $2) RETURNING id`,
        [workspaceId, staleBefore]);
      return rows.length;
    },
    async listWorkspacesWithJobs(statuses) {
      const rows = await exec.query<{ workspaceId: string }>(
        `SELECT DISTINCT workspace_id AS "workspaceId" FROM enrichment_jobs WHERE status = ANY($1)`,
        [statuses]);
      return rows.map((r) => r.workspaceId);
    },
  };
}
