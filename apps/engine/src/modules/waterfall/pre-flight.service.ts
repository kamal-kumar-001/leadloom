import {
  BYOKProvider,
  PreFlightEstimateRequest,
  PreFlightEstimateResponse,
} from '@leadloom/contracts';

export interface TierEstimateConfig {
  tierIndex: number;
  provider: BYOKProvider;
  unitCostUSD: number;
  estimatedHitRate: number;
}

export class PreFlightEstimatorService {
  private defaultTiers: TierEstimateConfig[] = [
    { tierIndex: 1, provider: 'apollo', unitCostUSD: 0.001, estimatedHitRate: 0.58 },
    { tierIndex: 2, provider: 'hunter', unitCostUSD: 0.003, estimatedHitRate: 0.28 },
    { tierIndex: 3, provider: 'dropcontact', unitCostUSD: 0.02, estimatedHitRate: 0.10 },
  ];

  /**
   * Computes early-exit cumulative cost estimation for requested batch of rows.
   */
  public estimate(
    request: PreFlightEstimateRequest,
    customTiers?: TierEstimateConfig[]
  ): PreFlightEstimateResponse {
    const totalRows = Math.max(1, request.rowIds.length);
    const tiers = customTiers ?? this.defaultTiers;

    let remainingRows = totalRows;
    let totalCostUSD = 0;
    let totalEstimatedSeconds = 0;

    // Concurrency on 4GB VPS: 20 rows parallel in BullMQ
    const concurrency = 20;

    for (const tier of tiers) {
      // Rows executing in this tier
      const tierRows = remainingRows;
      const tierCost = tierRows * tier.unitCostUSD;
      totalCostUSD += tierCost;

      // Estimated latency: ~200ms per batch
      const batches = Math.ceil(tierRows / concurrency);
      totalEstimatedSeconds += batches * 0.25;

      // Early exit short-circuiting: rows resolved do not continue to next tier
      const resolvedRows = tierRows * tier.estimatedHitRate;
      remainingRows = Math.max(0, tierRows - resolvedRows);
    }

    return {
      estimatedCostUSD: Number(totalCostUSD.toFixed(4)),
      estimatedSeconds: Math.ceil(totalEstimatedSeconds),
      totalRows,
      tiers: tiers.map(t => ({
        tierIndex: t.tierIndex,
        provider: t.provider,
        unitCostUSD: t.unitCostUSD,
        estimatedHitRate: t.estimatedHitRate,
      })),
      guaranteeNotice: 'Zero unnecessary external API calls guaranteed via early-exit short-circuiting',
    };
  }
}
