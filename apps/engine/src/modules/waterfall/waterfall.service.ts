import {
  DispatchWaterfallRequest,
  DispatchWaterfallResponse,
  PreFlightEstimateRequest,
  PreFlightEstimateResponse,
  WaterfallCellPayload,
} from '@leadloom/contracts';
import { DAGRunnerService, WaterfallNodeConfig } from './dag-runner.service';
import { DomainCacheService } from './domain-cache.service';
import { PreFlightEstimatorService } from './pre-flight.service';
import { ApolloAdapter } from './adapters/apollo.adapter';
import { HunterAdapter } from './adapters/hunter.adapter';
import { DropcontactAdapter } from './adapters/dropcontact.adapter';
import { ProviderExecutionInput } from './adapters/base-provider.adapter';

export class WaterfallService {
  private runner: DAGRunnerService;
  private domainCache: DomainCacheService;
  private estimator: PreFlightEstimatorService;

  constructor() {
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

  public async dispatchWaterfall(request: DispatchWaterfallRequest): Promise<DispatchWaterfallResponse> {
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
    nodeConfigs?: WaterfallNodeConfig[]
  ): Promise<WaterfallCellPayload> {
    const defaultConfigs: WaterfallNodeConfig[] = [
      { id: 'node-apollo', provider: 'apollo', tier: 1, costWeight: 100 },
      { id: 'node-hunter', provider: 'hunter', tier: 2, costWeight: 300 },
      { id: 'node-dropcontact', provider: 'dropcontact', tier: 3, costWeight: 2000 },
    ];

    return this.runner.executeRow(input, nodeConfigs ?? defaultConfigs);
  }
}
