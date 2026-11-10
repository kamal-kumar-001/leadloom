import { BYOKProvider } from '@leadloom/contracts';
import { BaseProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from './base-provider.adapter';

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
          costMicrocents: 0,
          errorMessage: 'Apollo API rate limit reached (HTTP 429)',
        };
      }

      if (!response.ok) {
        return {
          email: null,
          confidence: 0,
          status: 'error',
          latencyMs,
          costMicrocents: 0,
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
        costMicrocents: this.nominalCostMicrocents,
      };
    } catch (err) {
      return {
        email: null,
        confidence: 0,
        status: 'error',
        latencyMs: Date.now() - startTime,
        costMicrocents: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
