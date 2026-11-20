import { BYOKProvider } from '@leadloom/contracts';
import { BaseProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput, ProviderOutcomeUnknownError } from './base-provider.adapter.js';

export class ApolloAdapter extends BaseProviderAdapter {
  readonly provider: BYOKProvider = 'apollo';
  readonly nominalCostMicrocents: number = 100; // ~$0.001

  async execute(
    input: ProviderExecutionInput,
    apiKey?: string
  ): Promise<ProviderExecutionOutput> {
    const startTime = Date.now();

    // If apiKey is provided, real outbound call would be placed here.
    // In headless/offline or when domain matches known test patterns:
    if (!apiKey) {
      return { email: null, confidence: 0, status: 'error', latencyMs: 0,
        costMicrocents: 0, errorMessage: 'Provider credential required; no enrichment was performed' };
    }

    // Outbound HTTP call via fetch
    try {
      const response = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          domain: input.domain,
          first_name: input.firstName,
          last_name: input.lastName,
          organization_name: input.companyName,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (response.status === 429) {
        return {
          email: null,
          confidence: 0,
          status: 'rate_limited',
          latencyMs,
          // UNKNOWN BILLING, recorded explicitly: the provider ANSWERED; its
          // error-response billing policy is unverified, so this is an
          // ESTIMATE at the nominal rate - not measured, not a proven maximum.
          costMicrocents: this.nominalCostMicrocents,
          costAssumed: true,
          errorMessage: 'Apollo API rate limit reached (HTTP 429)',
        };
      }

      if (!response.ok) {
        return {
          email: null,
          confidence: 0,
          status: 'error',
          latencyMs,
          costMicrocents: this.nominalCostMicrocents,
          costAssumed: true,
          errorMessage: `Apollo error HTTP ${response.status}`,
        };
      }

      const data = await response.json() as { person?: { email?: string; email_status?: string } };
      const person = data.person;

      if (person?.email) {
        const isDeliverable = person.email_status === 'verified';
        return {
          email: person.email,
          confidence: isDeliverable ? 0.95 : 0.75,
          status: 'hit',
          verification: isDeliverable ? 'deliverable' : 'risky',
          latencyMs,
          costMicrocents: this.nominalCostMicrocents,
          rawResponse: data,
        };
      }

      return {
        email: null,
        confidence: 0,
        status: 'miss',
        latencyMs,
        // Provider answered with no match; whether a miss is billed is
        // policy-dependent and UNVERIFIED - estimated at the nominal rate,
        // not measured and not a ceiling.
        costMicrocents: this.nominalCostMicrocents,
        costAssumed: true,
      };
    } catch (err) {
      // D2 billing-integrity contract: a fetch-layer failure means the request
      // may have been submitted and charged - outcome UNKNOWN. Throw so the
      // worker classifies the row uncertain; never return a normalized
      // error-with-cost-0 result. (Provider-ANSWERED HTTP errors above remain
      // returned results, fail-closed at the nominal rate with costAssumed.)
      throw new ProviderOutcomeUnknownError(err instanceof Error ? err.message : String(err));
    }
  }
}
