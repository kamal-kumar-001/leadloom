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

    // Cost only. No time estimate is emitted: there is no measured latency
    // model, and an invented one would read as a promise. Unit costs and hit
    // rates are the configured assumptions above, not measured values - the
    // response carries costBasis so consumers label it that way.
    let remainingRows = totalRows;
    let totalCostUSD = 0;

    for (const tier of tiers) {
      // Rows executing in this tier
      const tierRows = remainingRows;
      const tierCost = tierRows * tier.unitCostUSD;
      totalCostUSD += tierCost;

      // Early exit short-circuiting: rows resolved do not continue to next tier
      const resolvedRows = tierRows * tier.estimatedHitRate;
      remainingRows = Math.max(0, tierRows - resolvedRows);
    }

    return {
      estimatedCostUSD: Number(totalCostUSD.toFixed(4)),
      costBasis: 'configured-assumptions',
      executionNote: 'Providers are tried in tier order; a resolved row is not sent to later tiers.',
      totalRows,
      tiers: tiers.map(t => ({
        tierIndex: t.tierIndex,
        provider: t.provider,
        unitCostUSD: t.unitCostUSD,
        estimatedHitRate: t.estimatedHitRate,
      })),
    };
  }
}
