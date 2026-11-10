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

  constructor(private readonly entitlements?: WaterfallEntitlementPort) {
    this.domainCache = new DomainCacheService();
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

    const totalQueued = request.rowIds.length;
    const estSeconds = Math.ceil(totalQueued * 0.2);
    const estimatedCompletionAt = new Date(Date.now() + estSeconds * 1000).toISOString();

    return {
      jobId: `job-${request.columnId.slice(0, 8)}-${Date.now()}`,
      totalQueued,
      estimatedCompletionAt,
    };
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
