import { BYOKProvider } from '@leadloom/contracts';
import { BaseProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from './base-provider.adapter';

export class DropcontactAdapter extends BaseProviderAdapter {
  readonly provider: BYOKProvider = 'dropcontact';
  readonly nominalCostMicrocents: number = 2000; // ~$0.02 (higher quality tier)

  async execute(
    input: ProviderExecutionInput,
    apiKey?: string
  ): Promise<ProviderExecutionOutput> {
    const startTime = Date.now();

    if (!apiKey) {
      return { email: null, confidence: 0, status: 'error', latencyMs: 0,
        costMicrocents: 0, errorMessage: 'Provider credential required; no enrichment was performed' };
    }

    try {
      const response = await fetch('https://api.dropcontact.io/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Token': apiKey,
        },
        body: JSON.stringify({
          data: [
            {
              first_name: input.firstName,
              last_name: input.lastName,
              website: input.domain,
              company: input.companyName,
            },
          ],
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
          errorMessage: 'Dropcontact rate limit reached',
        };
      }

      if (!response.ok) {
        return {
          email: null,
          confidence: 0,
          status: 'error',
          latencyMs,
          costMicrocents: 0,
          errorMessage: `Dropcontact error HTTP ${response.status}`,
        };
      }

      const data = await response.json() as {
        data?: Array<{ email?: Array<{ email: string; qualification?: string }> }>;
      };

      const person = data.data?.[0];
      const primaryEmail = person?.email?.[0];

      if (primaryEmail?.email) {
        const isNominal = primaryEmail.qualification === 'nominative';
        return {
          email: primaryEmail.email,
          confidence: isNominal ? 0.95 : 0.8,
          status: 'hit',
          verification: isNominal ? 'deliverable' : 'risky',
          latencyMs,
          costMicrocents: this.nominalCostMicrocents,
          rawResponse: data as Record<string, unknown>,
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
