/**
 * G3 worker loop skeleton. Iterates active campaigns and runs one dispatch
 * tick each. Sending is only possible when a repository was constructed with
 * sendingEnabled AND jobs were released through the gated release step; main
 * does not mount this worker in any current deployment. One campaign's failure
 * never kills the loop: it is counted and the tick continues.
 */
export interface WorkerCampaignSource {
  listActiveCampaigns(): Promise<Array<{ workspaceId: string; campaignId: string }>>;
}
export interface TickResult {
  campaigns: number;
  accepted: number;
  uncertain: number;
  idle: number;
  errors: number;
}

export class OutboundWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(
    private readonly dispatch: { dispatchOnce(workspaceId: string, campaignId: string): Promise<'idle' | 'accepted' | 'uncertain'> },
    private readonly source: WorkerCampaignSource,
    private readonly opts: { intervalMs?: number; onTickError?: (error: unknown) => void } = {},
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    const loop = async () => {
      if (!this.running) return;
      try {
        await this.tick();
      } catch (e) {
        this.opts.onTickError?.(e);
      }
      if (this.running) this.timer = setTimeout(loop, this.opts.intervalMs ?? 60_000);
    };
    void loop();
  }

  public stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  public async tick(): Promise<TickResult> {
    const campaigns = await this.source.listActiveCampaigns();
    const result: TickResult = { campaigns: campaigns.length, accepted: 0, uncertain: 0, idle: 0, errors: 0 };
    for (const c of campaigns) {
      try {
        const r = await this.dispatch.dispatchOnce(c.workspaceId, c.campaignId);
        if (r === 'accepted') result.accepted++;
        else if (r === 'uncertain') result.uncertain++;
        else result.idle++;
      } catch {
        result.errors++;
      }
    }
    return result;
  }
}
