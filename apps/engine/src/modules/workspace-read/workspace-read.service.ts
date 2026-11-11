/**
 * Read-only, tenant-scoped views over data that already exists in the database.
 * Every query is filtered by the workspace id taken from the verified session.
 * Selects are explicit allow-lists: mailbox token/DEK columns and campaign step
 * bodies are never read here. No writes, no derived or invented numbers.
 */
export interface WorkspaceReadDb {
  table: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]>; findFirst(a: any): Promise<any> };
  column: { findMany(a: any): Promise<any[]> };
  row: { findMany(a: any): Promise<any[]> };
  cell: { findMany(a: any): Promise<any[]> };
  mailbox: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]> };
  campaign: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]> };
  suppressionList: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]> };
  validationExperiment: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]> };
  byokCredential: { count(a: any): Promise<number> };
}

const LIMIT = 100;

export class WorkspaceReadService {
  constructor(private readonly db: WorkspaceReadDb) {}

  async summary(workspaceId: string) {
    const where = { workspaceId };
    const [tables, mailboxes, campaigns, suppressions, experiments, providerKeys] = await Promise.all([
      this.db.table.count({ where }),
      this.db.mailbox.count({ where }),
      this.db.campaign.count({ where }),
      this.db.suppressionList.count({ where }),
      this.db.validationExperiment.count({ where }),
      this.db.byokCredential.count({ where }),
    ]);
    return { tables, mailboxes, campaigns, suppressions, experiments, providerKeys };
  }

  listTables(workspaceId: string) {
    return this.db.table.findMany({
      where: { workspaceId },
      select: { id: true, name: true, rowCount: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
  }

  /**
   * Rows of one table with their cell values keyed by column name. The table
   * must belong to the session workspace; otherwise this returns null (404 at
   * the route) - never another tenant's data.
   */
  async listTableRows(workspaceId: string, tableId: string) {
    const table = await this.db.table.findFirst({ where: { id: tableId, workspaceId } });
    if (!table) return null;
    const [columns, rows] = await Promise.all([
      this.db.column.findMany({ where: { tableId }, orderBy: { orderIndex: 'asc' } }),
      this.db.row.findMany({ where: { tableId }, orderBy: { orderIndex: 'asc' }, take: LIMIT }),
    ]);
    const cells = await this.db.cell.findMany({ where: { tableId, rowId: { in: rows.map((r: any) => r.id) } } });
    const nameOf: Record<string, string> = {};
    for (const c of columns) nameOf[c.id] = c.name;
    return {
      table: { id: table.id, name: table.name, rowCount: table.rowCount },
      columns: columns.map((c: any) => ({ id: c.id, name: c.name, type: c.type })),
      rows: rows.map((r: any) => {
        const values: Record<string, unknown> = {};
        for (const cell of cells.filter((c: any) => c.rowId === r.id)) {
          const name = nameOf[cell.columnId];
          if (name) values[name] = cell.value;
        }
        return { rowId: r.id, values };
      }),
    };
  }

  listMailboxes(workspaceId: string) {
    return this.db.mailbox.findMany({
      where: { workspaceId },
      select: {
        id: true, email: true, spfStatus: true, dkimStatus: true, dmarcStatus: true,
        healthScore: true, dailySendLimit: true, sentToday: true, isPaused: true,
        lastHealthCheckAt: true, createdAt: true,
        authType: true, connectionStatus: true, connectionCheckedAt: true, connectionErrorCode: true,
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
  }

  listCampaigns(workspaceId: string) {
    return this.db.campaign.findMany({
      where: { workspaceId },
      select: { id: true, name: true, status: true, dailyLimitTotal: true, scheduleTimezone: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
  }

  /** Suppressions: a short hash prefix, reason and source only. The raw address is never stored and never reconstructed. */
  async listSuppressions(workspaceId: string) {
    const rows = await this.db.suppressionList.findMany({
      where: { workspaceId },
      select: { id: true, emailHash: true, reason: true, source: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return rows.map((r: any) => ({ id: r.id, hashPrefix: String(r.emailHash).slice(0, 8), reason: r.reason, source: r.source, createdAt: r.createdAt }));
  }

  /** Experiments: status metadata plus a truncated hypothesis. No ICP spec, sequence copy or page content. */
  async listExperiments(workspaceId: string) {
    const rows = await this.db.validationExperiment.findMany({
      where: { workspaceId },
      select: {
        id: true, hypothesis: true, verdict: true, verdictScore: true, createdAt: true,
        smokeTestPages: { select: { slug: true, visitors: true, _count: { select: { waitlistLeads: true } } }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return rows.map((r: any) => ({
      id: r.id,
      hypothesis: String(r.hypothesis).slice(0, 140),
      verdict: r.verdict,
      verdictScore: r.verdictScore,
      createdAt: r.createdAt,
      slug: r.smokeTestPages?.[0]?.slug ?? null,
      visitors: r.smokeTestPages?.[0]?.visitors ?? 0,
      waitlistCount: r.smokeTestPages?.[0]?._count?.waitlistLeads ?? 0,
    }));
  }
}
