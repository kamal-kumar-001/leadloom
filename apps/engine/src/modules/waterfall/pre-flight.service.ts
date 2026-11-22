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

export class PreFlightUnavailableError extends Error {readonly statusCode=503;constructor(){super('Live waterfall pricing and execution estimates are unavailable. No provider quote or completion time is established.');}}

export class PreFlightEstimatorService {

  /**
   * Computes early-exit cumulative cost estimation for requested batch of rows.
   */
  public estimate(
    request: PreFlightEstimateRequest,
    customTiers?: TierEstimateConfig[]
  ): PreFlightEstimateResponse {
    if(!customTiers?.length)throw new PreFlightUnavailableError();
    const totalRows = request.rowIds.length;
    if(totalRows===0)throw new Error('Select at least one row');
    const tiers = customTiers;
    for(const tier of tiers)if(!Number.isFinite(tier.unitCostUSD)||tier.unitCostUSD<0||!Number.isFinite(tier.estimatedHitRate)||tier.estimatedHitRate<0||tier.estimatedHitRate>1)throw new Error('Invalid supplied simulation assumptions');

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
      guaranteeNotice: 'Simulation from caller-supplied assumptions only. Not a provider quote, measured hit rate, execution-time promise or spending authorization.',
    };
  }
}
