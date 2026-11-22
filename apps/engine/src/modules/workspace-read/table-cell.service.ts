import type { TransactionalDatabase } from '../outbound/atomic-dispatch.repository';
import { randomUUID } from 'node:crypto';
export class CellEditConflict extends Error {}
export class CellEditUnsupported extends Error {}
export interface TextCellEdit { rowId: string; columnId: string; expectedValue: string | null; value: string }

/** Deliberately edits text only. Enrichment objects and typed columns stay read-only. */
export class TableCellService {
  constructor(private readonly database: TransactionalDatabase) {}
  async edit(workspaceId: string, tableId: string, input: TextCellEdit, projectId?:string) {
    return this.database.transaction(async (tx) => {
      const tables = await tx.query('SELECT id FROM tables WHERE id=$1::uuid AND workspace_id=$2::uuid'+(projectId?' AND project_id=$3::uuid':'')+' FOR UPDATE', projectId?[tableId,workspaceId,projectId]:[tableId, workspaceId]);
      if (!tables.length) return null;
      const columns = await tx.query<{type: string}>('SELECT type FROM columns WHERE id=$1::uuid AND table_id=$2::uuid', [input.columnId, tableId]);
      const rows = await tx.query('SELECT id FROM rows WHERE id=$1::uuid AND table_id=$2::uuid', [input.rowId, tableId]);
      if (!columns.length || !rows.length) return null;
      if (columns[0].type !== 'text') throw new CellEditUnsupported();
      const cells = await tx.query<{value: unknown}>('SELECT value FROM cells WHERE table_id=$1::uuid AND row_id=$2::uuid AND column_id=$3::uuid FOR UPDATE', [tableId, input.rowId, input.columnId]);
      const current = cells[0]?.value ?? null;
      if (current !== null && typeof current !== 'string') throw new CellEditUnsupported();
      // A network retry after a committed write is safe. Do not rewrite data or
      // timestamps when the requested value is already present.
      if (current === input.value) return { saved: true, value: input.value, changed: false };
      if (current !== input.expectedValue) throw new CellEditConflict();
      const written = await tx.query(`INSERT INTO cells(id,table_id,row_id,column_id,value,updated_at)
        VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb,clock_timestamp())
        ON CONFLICT(row_id,column_id) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at
        WHERE coalesce(cells.value,'null'::jsonb)=$6::jsonb RETURNING id`,
        [randomUUID(), tableId, input.rowId, input.columnId, JSON.stringify(input.value), JSON.stringify(input.expectedValue)]);
      if (!written.length) throw new CellEditConflict();
      await tx.query('UPDATE tables SET updated_at=clock_timestamp() WHERE id=$1::uuid AND workspace_id=$2::uuid', [tableId, workspaceId]);
      return { saved: true, value: input.value, changed: true };
    });
  }
}
