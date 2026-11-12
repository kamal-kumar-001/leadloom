import {
  BYOKProvider,
  WaterfallCellPayload,
  WaterfallStepTrace,
  WaterfallStepStatus,
} from '@leadloom/contracts';
import { createHash } from 'node:crypto';
import { BaseProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from './adapters/base-provider.adapter';
import { DomainCacheService } from './domain-cache.service';

export interface WaterfallNodeConfig {
  id: string;
  provider: BYOKProvider;
  tier: number;
  costWeight?: number;
  dependencies?: string[]; // IDs of preceding nodes that must complete first
  exitPredicate?: (output: ProviderExecutionOutput) => boolean;
}

export class DAGRunnerService {
  private adapters = new Map<BYOKProvider, BaseProviderAdapter>();

  constructor(
    private readonly domainCache: DomainCacheService = new DomainCacheService()
  ) {}

  public registerAdapter(adapter: BaseProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  public getAdapter(provider: BYOKProvider): BaseProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * Sorts nodes topologically respecting dependencies, then orders by tier / cost weight.
   */
  public sortNodes(nodes: WaterfallNodeConfig[]): WaterfallNodeConfig[] {
    const nodeMap = new Map<string, WaterfallNodeConfig>();
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const node of nodes) {
      if (nodeMap.has(node.id)) throw new Error(`Duplicate DAG node ID: ${node.id}`);
      nodeMap.set(node.id, node);
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    // Build graph
    for (const node of nodes) {
      if (node.dependencies && node.dependencies.length > 0) {
        for (const depId of node.dependencies) {
          if (!nodeMap.has(depId)) {
            throw new Error(`Invalid DAG: Node "${node.id}" references non-existent dependency "${depId}".`);
          }
          adjList.get(depId)!.push(node.id);
          inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
        }
      }
    }

    // Kahn's algorithm with tier/cost priority
    const queue: WaterfallNodeConfig[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(nodeMap.get(id)!);
      }
    }

    // Sort queue by tier ascending, then costWeight ascending
    queue.sort((a, b) => (a.tier - b.tier) || ((a.costWeight ?? 0) - (b.costWeight ?? 0)));

    const sorted: WaterfallNodeConfig[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const neighbors = adjList.get(current.id) ?? [];
      for (const neighborId of neighbors) {
        const newDeg = (inDegree.get(neighborId) ?? 1) - 1;
        inDegree.set(neighborId, newDeg);
        if (newDeg === 0) {
          queue.push(nodeMap.get(neighborId)!);
        }
      }
      queue.sort((a, b) => (a.tier - b.tier) || ((a.costWeight ?? 0) - (b.costWeight ?? 0)));
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Cycle detected in Waterfall DAG configuration.');
    }

    return sorted;
  }

  /**
   * Default exit predicate: verifies if output has deliverable email with confidence >= 0.8.
   */
  public static defaultExitPredicate(output: ProviderExecutionOutput): boolean {
    return (
      output.status === 'hit' &&
      !!output.email &&
      output.verification === 'deliverable' &&
      output.confidence >= 0.8
    );
  }

  /**
   * Executes adaptive DAG waterfall for a single row with early-exit short-circuiting.
   */
  public async executeRow(
    input: ProviderExecutionInput,
    nodeConfigs: WaterfallNodeConfig[],
    apiKeys?: Partial<Record<BYOKProvider, string>>
  ): Promise<WaterfallCellPayload> {
    const sortedNodes = this.sortNodes(nodeConfigs);
    // A domain identifies a company, not a person. Cache complete lookup identity
    // inside the authenticated tenant. No tenant scope means no cache reuse.
    const cacheScope = input.workspaceId ? createHash('sha256').update(JSON.stringify([
      input.workspaceId, input.firstName?.trim().toLowerCase() ?? '', input.lastName?.trim().toLowerCase() ?? '',
      input.companyName?.trim().toLowerCase() ?? '', input.title?.trim().toLowerCase() ?? '',
    ])).digest('hex') : undefined;
    const trace: WaterfallStepTrace[] = [];
    let totalCostMicrocents = 0;
    let totalLatencyMs = 0;
    let shortCircuited = false;
    let successfulOutput: ProviderExecutionOutput | null = null;
    let attributedProvider: BYOKProvider | undefined;
    let attributedTier: number | undefined;

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const stepIndex = i + 1;

      if (shortCircuited) {
        // Zero unnecessary external API calls guaranteed
        trace.push({
          step: stepIndex,
          provider: node.provider,
          status: 'skipped',
          latency_ms: 0,
          cost_microcents: 0,
          reason: 'Short-circuited: Previous tier satisfied exit criteria (zero unnecessary API calls)',
        });
        continue;
      }

      const adapter = this.adapters.get(node.provider);
      if (!adapter) {
        trace.push({
          step: stepIndex,
          provider: node.provider,
          status: 'error',
          latency_ms: 0,
          cost_microcents: 0,
          reason: `No adapter registered for provider: ${node.provider}`,
        });
        continue;
      }

      // 1. Check FinOps 30-Day Domain Cache
      const cached = cacheScope ? await this.domainCache.get<ProviderExecutionOutput>(node.provider, input.domain, cacheScope) : null;
      let output: ProviderExecutionOutput;
      let isCacheHit = false;

      if (cached) {
        isCacheHit = true;
        output = {
          ...cached.responsePayload,
          costMicrocents: 0, // FinOps guarantee: cached calls cost $0.00
          latencyMs: 1,
        };
      } else {
        const apiKey = apiKeys?.[node.provider];
        try {
          output = await adapter.execute(input, apiKey);
        } catch {
          // Do not expose raw provider errors which may contain credentials.
          trace.push({ step: stepIndex, provider: node.provider, status: 'error', latency_ms: 0,
            cost_microcents: 0, reason: 'Provider execution failed' });
          continue;
        }

        // Store successful/deliverable payload in 30-day domain cache
        if (cacheScope && output.status === 'hit' && output.email) {
          await this.domainCache.set(
            node.provider,
            input.domain,
            output,
            output.costMicrocents,
            undefined,
            cacheScope
          );
        }
      }

      totalCostMicrocents += output.costMicrocents;
      totalLatencyMs += output.latencyMs;

      // Map output to trace item
      const traceItem: WaterfallStepTrace = {
        step: stepIndex,
        provider: node.provider,
        status: isCacheHit ? 'hit' : output.status,
        latency_ms: output.latencyMs,
        cost_microcents: output.costMicrocents,
        reason: isCacheHit
          ? 'FinOps 30-day domain cache hit ($0.00 external cost)'
          : output.errorMessage ?? (output.status === 'hit' ? 'Match found' : 'No record found'),
        verification: output.verification,
        score: Math.round(output.confidence * 100),
      };
      trace.push(traceItem);

      // Evaluate exit predicate
      const exitPredicate = node.exitPredicate ?? DAGRunnerService.defaultExitPredicate;
      if (exitPredicate(output)) {
        shortCircuited = true;
        successfulOutput = output;
        attributedProvider = node.provider;
        attributedTier = node.tier;
      }
    }

    if (successfulOutput && successfulOutput.email) {
      const isFallback = (attributedTier ?? 1) > 1;
      return {
        value: successfulOutput.email,
        status: isFallback ? 'fallback_used' : 'success',
        confidence: successfulOutput.confidence,
        telemetry: {
          provider_attributed: attributedProvider,
          tier: attributedTier,
          latency_ms: totalLatencyMs,
          cost_microcents: totalCostMicrocents,
        },
        trace,
      };
    }

    // If exhausted
    const allRateLimited = trace.length > 0 && trace.every(t => t.status === 'rate_limited');
    if (allRateLimited) {
      return {
        value: null,
        status: 'error',
        trace,
        error_payload: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'All configured providers hit rate limits',
          retryable: true,
        },
      };
    }

    return {
      value: null,
      status: 'exhausted',
      confidence: 0,
      telemetry: {
        latency_ms: totalLatencyMs,
        cost_microcents: totalCostMicrocents,
      },
      trace,
    };
  }
}
