import {
  DispatchWaterfallRequest,
  DispatchWaterfallResponse,
  PreFlightEstimateRequest,
  PreFlightEstimateResponse,
  WaterfallCellPayload,
  FeatureKey,
  LimitKey,
  EntitlementDecision,
} from '@leadloom/contracts';
import { DAGRunnerService, WaterfallNodeConfig } from './dag-runner.service';
import { DomainCacheService } from './domain-cache.service';
import { PreFlightEstimatorService } from './pre-flight.service';
import { ApolloAdapter } from './adapters/apollo.adapter';
import { HunterAdapter } from './adapters/hunter.adapter';
import { DropcontactAdapter } from './adapters/dropcontact.adapter';
import { ProviderExecutionInput } from './adapters/base-provider.adapter';

export interface WaterfallEntitlementPort {
  checkFeature(workspaceId: string, feature: FeatureKey): Promise<EntitlementDecision>;
  checkLimit(workspaceId: string, limit: LimitKey, requested?: number): Promise<EntitlementDecision>;
}

/**
 * Durable dispatch is not built yet: dispatch must never fabricate a job id
 * that implies queued work when nothing is persisted (D2). A real queue port
 * is injected once the persistence path is reviewed and approved.
 */
export class WaterfallDispatchUnavailableError extends Error {
  constructor() {
    super('Durable waterfall dispatch is not implemented: nothing was queued');
    this.name = 'WaterfallDispatchUnavailableError';
  }
}

export interface WaterfallDispatchQueue {
  enqueue(input: { workspaceId?: string; request: DispatchWaterfallRequest }): Promise<{ jobId: string }>;
  /** Status read for D3. Optional: a queue without a reader keeps the honest
   *  unavailable posture rather than fabricating progress. */
  getJob?(workspaceId: string, jobId: string): Promise<WaterfallJobStatusRecord | null>;
}

export interface WaterfallJobStatusRecord {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_review';
  totalQueued: number;
  completedRowIds: string[];
  uncertainRowIds: string[];
  attempts: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class WaterfallJobNotFoundError extends Error {
  constructor() {
    super('Waterfall job not found');
    this.name = 'WaterfallJobNotFoundError';
  }
}

export class WaterfallEntitlementError extends Error {
  constructor(message: string, public readonly decision: EntitlementDecision) {
    super(message);
    this.name = 'WaterfallEntitlementError';
  }
}

export class WaterfallService {
  private runner: DAGRunnerService;
  private domainCache: DomainCacheService;
  private estimator: PreFlightEstimatorService;

  constructor(
    private readonly entitlements?: WaterfallEntitlementPort,
    domainCache?: DomainCacheService,
    private readonly dispatchQueue?: WaterfallDispatchQueue
  ) {
    this.domainCache = domainCache ?? new DomainCacheService();
    this.runner = new DAGRunnerService(this.domainCache);
    this.estimator = new PreFlightEstimatorService();

    // Register default vendors
    this.runner.registerAdapter(new ApolloAdapter());
    this.runner.registerAdapter(new HunterAdapter());
    this.runner.registerAdapter(new DropcontactAdapter());
  }

  public getRunner(): DAGRunnerService {
    return this.runner;
  }

  public getDomainCache(): DomainCacheService {
    return this.domainCache;
  }

  public getEstimator(): PreFlightEstimatorService {
    return this.estimator;
  }

  public estimatePreFlight(request: PreFlightEstimateRequest): PreFlightEstimateResponse {
    return this.estimator.estimate(request);
  }

  /**
   * Asserts entitlement checks fail closed:
   * 1. Rejects missing workspaceId when entitlements are active or enforced.
   * 2. Allows a missing EntitlementPort ONLY if LEADLOOM_ENTITLEMENTS_ENFORCED !== 'true'.
   * 3. Evaluates feature and credit limits through the injected port.
   */
  private async assertEntitlements(workspaceId: string | undefined, credits: number): Promise<void> {
    const isEnforced = process.env.LEADLOOM_ENTITLEMENTS_ENFORCED === 'true';

    if (this.entitlements || isEnforced) {
      if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
        throw new WaterfallEntitlementError(
          'Missing workspaceId: all waterfall operations must be tenant-scoped',
          { allowed: false, reason: 'no_plan' }
        );
      }

      if (!this.entitlements) {
        throw new WaterfallEntitlementError(
          'Missing entitlement service: LEADLOOM_ENTITLEMENTS_ENFORCED is active but no EntitlementPort was provided',
          { allowed: false, reason: 'billing_inactive' }
        );
      }

      const featureDecision = await this.entitlements.checkFeature(workspaceId, 'waterfall');
      if (!featureDecision.allowed) {
        throw new WaterfallEntitlementError(
          `Waterfall feature is not permitted on the current plan: ${featureDecision.reason}`,
          featureDecision
        );
      }

      const limitDecision = await this.entitlements.checkLimit(
        workspaceId,
        'enrichment_credits_per_month',
        credits
      );
      if (!limitDecision.allowed) {
        throw new WaterfallEntitlementError(
          `Enrichment credit limit exceeded: ${limitDecision.reason}`,
          limitDecision
        );
      }
    }
  }

  public async dispatchWaterfall(
    request: DispatchWaterfallRequest,
    workspaceId?: string
  ): Promise<DispatchWaterfallResponse> {
    await this.assertEntitlements(workspaceId, request.rowIds.length);

    if (!this.dispatchQueue) throw new WaterfallDispatchUnavailableError();

    const totalQueued = request.rowIds.length;
    const { jobId } = await this.dispatchQueue.enqueue({ workspaceId, request });
    const estSeconds = Math.ceil(totalQueued * 0.2);
    const estimatedCompletionAt = new Date(Date.now() + estSeconds * 1000).toISOString();

    return { jobId, totalQueued, estimatedCompletionAt };
  }

  /** D3 read model: honest job status from the durable store. Without a
   *  queue reader the same unavailable posture as dispatch applies; a job
   *  outside the workspace is NotFound, never leaked. */
  public async getJobStatus(workspaceId: string, jobId: string) {
    if (!this.dispatchQueue?.getJob) throw new WaterfallDispatchUnavailableError();
    const job = await this.dispatchQueue.getJob(workspaceId, jobId);
    if (!job) throw new WaterfallJobNotFoundError();
    return {
      jobId: job.id,
      status: job.status,
      totalQueued: job.totalQueued,
      completedCount: job.completedRowIds.length,
      uncertainCount: job.uncertainRowIds.length,
      attempts: job.attempts,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  /** D3 review surface: the uncertain row ids of a job, tenant-fenced like
   *  the status read. Ids only; row content stays grid territory. */
  public async getJobUncertainRows(workspaceId: string, jobId: string) {
    if (!this.dispatchQueue?.getJob) throw new WaterfallDispatchUnavailableError();
    const job = await this.dispatchQueue.getJob(workspaceId, jobId);
    if (!job) throw new WaterfallJobNotFoundError();
    return { jobId: job.id, uncertainRowIds: job.uncertainRowIds, uncertainCount: job.uncertainRowIds.length };
  }

  public async executeSingleRow(
    input: ProviderExecutionInput,
    nodeConfigs?: WaterfallNodeConfig[],
    workspaceId?: string
  ): Promise<WaterfallCellPayload> {
    await this.assertEntitlements(workspaceId, 1);

    const defaultConfigs: WaterfallNodeConfig[] = [
      { id: 'node-apollo', provider: 'apollo', tier: 1, costWeight: 100 },
      { id: 'node-hunter', provider: 'hunter', tier: 2, costWeight: 300 },
      { id: 'node-dropcontact', provider: 'dropcontact', tier: 3, costWeight: 2000 },
    ];

    return this.runner.executeRow(input, nodeConfigs ?? defaultConfigs);
  }
}
