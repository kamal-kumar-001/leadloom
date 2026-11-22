import { escapeCsvCell } from '../validator/csv-export';
export class TableExportLimit extends Error {}
/** A bounded, consistent database snapshot. Never download a silent partial export. */
export class TableExportService {
  constructor(private readonly prisma: any) {}
  async export(workspaceId: string, tableId: string): Promise<{ csv: string; rowCount: number } | null> {
    return this.prisma.$transaction(async (tx: any) => {
      const table = await tx.table.findFirst({ where: { id: tableId, workspaceId }, select: { id: true } });
      if (!table) return null;
      const columns = await tx.column.findMany({ where: { tableId }, orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }], take: 101, select: { id: true, name: true } });
      const rows = await tx.row.findMany({ where: { tableId }, orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }], take: 5001, select: { id: true } });
      if (columns.length > 100 || rows.length > 5000) throw new TableExportLimit();
      // Bound the payload before loading full JSON values into application RAM.
      const budget = await tx.$queryRawUnsafe('SELECT coalesce(sum(octet_length(value::text)),0)::bigint AS bytes,count(*)::int AS cell_count FROM cells WHERE table_id=$1::uuid', tableId);
      if (Number(budget[0]?.bytes ?? 0) > 2_000_000 || Number(budget[0]?.cell_count ?? 0) > 100000) throw new TableExportLimit();
      const cells = await tx.cell.findMany({ where: { tableId }, select: { rowId: true, columnId: true, value: true } });
      const values = new Map<string, Map<string, unknown>>();
      for (const cell of cells) { let row = values.get(cell.rowId); if (!row) { row = new Map(); values.set(cell.rowId, row); } row.set(cell.columnId, cell.value); }
      const lines = [columns.map((c: any) => escapeCsvCell(c.name)).join(',')];
      for (const row of rows) lines.push(columns.map((c: any) => escapeCsvCell(values.get(row.id)?.get(c.id))).join(','));
      const csv = lines.join('\r\n');
      if (Buffer.byteLength(csv, 'utf8') > 4_000_000) throw new TableExportLimit();
      return { csv, rowCount: rows.length };
    }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
  }
}
