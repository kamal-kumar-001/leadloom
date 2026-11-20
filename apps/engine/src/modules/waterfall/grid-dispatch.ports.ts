import type { WaterfallCellPayload } from '@leadloom/contracts';
import { z } from 'zod';
import { BYOKProviderEnum } from '@leadloom/contracts';
import type { ProviderExecutionInput } from './adapters/base-provider.adapter';
import type { WaterfallNodeConfig } from './dag-runner.service';
import type { SqlExecutor } from './sql-enrichment-jobs-store';
import type { DispatchResultSink, DispatchRowSource, EnrichmentJobRow } from './dispatch-queue';

/**
 * Concrete grid wiring for the D2 worker's DispatchRowSource /
 * DispatchResultSink ports. These adapters read and write the EXISTING grid
 * tables (columns/rows/cells) through narrow access interfaces; nothing here
 * is mounted at runtime - worker activation stays OFF and main.ts wires no
 * worker. Production acceptance UNPROVED; exercised only against the
 * isolated disposable PGlite fixture.
 *
 * Proposed convention (product decision still open, named exactly): a
 * waterfall column declares its input column via config.sourceColumnId.
 * Without it, row resolution FAILS with a clear error - no guessing which
 * text column holds the domain.
 */

export interface GridColumnRecord {
  id: string;
  tableId: string;
  type: string;
  config: Record<string, unknown>;
}

export interface GridCellRecord {
  value: unknown;
  updatedAt: Date;
}

/** Narrow read/write surface over grid tables. Every method is tenant-fenced
 *  by workspaceId (the implementation joins tables.workspace_id). */
export interface GridAccess {
  getColumn(workspaceId: string, columnId: string): Promise<GridColumnRecord | null>;
  getCell(workspaceId: string, rowId: string, columnId: string): Promise<GridCellRecord | null>;
  /** Guarded write: store the payload only when no cell exists or the
   *  existing cell is not newer than `notNewerThan` (the job's ENQUEUE time).
   *  Anything written after the user dispatched - a manual edit or a later
   *  dispatch, before OR after the claim - always wins; a job result never
   *  clobbers it. Completed rows are never re-run, so a job cannot conflict
   *  with its own earlier writes. */
  upsertCellGuarded(
    workspaceId: string,
    rowId: string,
    columnId: string,
    value: WaterfallCellPayload,
    notNewerThan: Date,
  ): Promise<boolean>;
}

export class GridDispatchRowSource implements DispatchRowSource {
  constructor(private readonly grid: GridAccess) {}

  async resolve(job: EnrichmentJobRow, rowId: string): Promise<ProviderExecutionInput> {
    const column = await this.grid.getColumn(job.workspaceId, job.columnId);
    if (!column) throw new Error(`waterfall column ${job.columnId} not found in workspace ${job.workspaceId}`);
    const sourceColumnId = typeof column.config?.sourceColumnId === 'string' ? column.config.sourceColumnId : null;
    if (!sourceColumnId) {
      throw new Error(
        `waterfall column ${job.columnId} has no config.sourceColumnId: the input-column convention is an open product decision; refusing to guess`,
      );
    }
    const cell = await this.grid.getCell(job.workspaceId, rowId, sourceColumnId);
    const domain = typeof cell?.value === 'string' ? cell.value.trim() : '';
    if (!domain) throw new Error(`row ${rowId} has no domain value in source column ${sourceColumnId}`);
    return { domain, workspaceId: job.workspaceId };
  }
}

export class GridDispatchResultSink implements DispatchResultSink {
  constructor(private readonly grid: GridAccess) {}

  async write(job: EnrichmentJobRow, rowId: string, payload: WaterfallCellPayload): Promise<void> {
    // Threshold is the ENQUEUE time (createdAt), not the claim time: an edit
    // made after dispatch but before the claim must also win.
    await this.grid.upsertCellGuarded(
      job.workspaceId,
      rowId,
      job.columnId,
      payload,
      job.createdAt,
    );
  }
}

/**
 * Production GridAccess over the shared SqlExecutor: the SAME statements the
 * isolated PGlite fixture exercises (dispatch-queue-db.spec.ts builds this
 * with a PGlite executor) are what the Prisma adapter runs on a host. The
 * read-then-upsert guard is a check-then-write race, narrowed not
 * eliminated - the same documented posture as the PGlite fixture.
 */
export function sqlGridAccess(exec: SqlExecutor): GridAccess {
  const access: GridAccess = {
    async getColumn(workspaceId, columnId) {
      const rows = await exec.query<GridColumnRecord>(
        `SELECT c.id, c.table_id AS "tableId", c.type, c.config FROM columns c
         JOIN tables t ON t.id=c.table_id WHERE t.workspace_id=$1 AND c.id=$2`, [workspaceId, columnId]);
      return rows[0] ?? null;
    },
    async getCell(workspaceId, rowId, columnId) {
      const rows = await exec.query<{ value: unknown; updatedAt: string | Date }>(
        `SELECT ce.value, ce.updated_at AS "updatedAt" FROM cells ce
         JOIN rows r ON r.id=ce.row_id JOIN tables t ON t.id=r.table_id
         WHERE t.workspace_id=$1 AND ce.row_id=$2 AND ce.column_id=$3`, [workspaceId, rowId, columnId]);
      const row = rows[0];
      return row ? { value: row.value, updatedAt: new Date(row.updatedAt) } : null;
    },
    async upsertCellGuarded(workspaceId, rowId, columnId, value, notNewerThan) {
      const existing = await access.getCell(workspaceId, rowId, columnId);
      if (existing && existing.updatedAt > notNewerThan) return false; // newer value wins
      await exec.query(
        `INSERT INTO cells (row_id, column_id, value) VALUES ($1,$2,$3)
         ON CONFLICT (row_id, column_id) DO UPDATE SET value=$3, updated_at=now()`,
        [rowId, columnId, JSON.stringify(value)]);
      return true;
    },
  };
  return access;
}

/** Persisted node-config shape (column config). exitPredicate is a function
 *  and can never be persisted; persisted nodes support the static fields only. */
const PersistedNodeConfigSchema = z.object({
  id: z.string().min(1),
  provider: BYOKProviderEnum,
  tier: z.number().int(),
  costWeight: z.number().optional(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Per-job node-config resolution from the waterfall column's config.nodes,
 * the same "column config declares it" convention as sourceColumnId: absent
 * or malformed config FAILS LOUD - the worker records the named error,
 * nothing is guessed and no provider is tried.
 */
export class GridNodeConfigResolver {
  constructor(private readonly grid: GridAccess) {}

  async resolve(job: EnrichmentJobRow): Promise<WaterfallNodeConfig[]> {
    const column = await this.grid.getColumn(job.workspaceId, job.columnId);
    if (!column) throw new Error(`waterfall column ${job.columnId} not found in workspace ${job.workspaceId}`);
    const raw = (column.config as Record<string, unknown> | null)?.nodes;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(
        `waterfall column ${job.columnId} has no config.nodes: the node-config convention is an open product decision; refusing to guess providers`,
      );
    }
    return raw.map((entry, i) => {
      const parsed = PersistedNodeConfigSchema.safeParse(entry);
      if (!parsed.success) {
        throw new Error(`waterfall column ${job.columnId} config.nodes[${i}] is malformed: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      }
      return parsed.data as WaterfallNodeConfig;
    });
  }
}
