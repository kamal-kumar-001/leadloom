/**
 * Read-only, tenant-scoped views over data that already exists in the database.
 * Every query is filtered by the workspace id taken from the verified session.
 * Selects are explicit allow-lists: mailbox token/DEK columns and campaign step
 * bodies are never read here. No writes, no derived or invented numbers.
 */
export interface WorkspaceReadDb {
  table: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]> };
  mailbox: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]> };
  campaign: { count(a: any): Promise<number>; findMany(a: any): Promise<any[]> };
  suppressionList: { count(a: any): Promise<number> };
  validationExperiment: { count(a: any): Promise<number> };
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

  listMailboxes(workspaceId: string) {
    return this.db.mailbox.findMany({
      where: { workspaceId },
      select: {
        id: true, email: true, spfStatus: true, dkimStatus: true, dmarcStatus: true,
        healthScore: true, dailySendLimit: true, sentToday: true, isPaused: true,
        lastHealthCheckAt: true, createdAt: true,
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
}
