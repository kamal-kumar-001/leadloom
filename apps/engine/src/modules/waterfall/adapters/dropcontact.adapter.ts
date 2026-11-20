import { BYOKProvider } from '@leadloom/contracts';
import { BaseProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput, ProviderOutcomeUnknownError } from './base-provider.adapter.js';

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
          // UNKNOWN BILLING, recorded explicitly: the provider ANSWERED; its
          // error-response billing policy is unverified, so this is an
          // ESTIMATE at the nominal rate - not measured, not a proven maximum.
          costMicrocents: this.nominalCostMicrocents,
          costAssumed: true,
          errorMessage: 'Dropcontact rate limit reached',
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
          // ESTIMATE at the nominal rate: no provider-reported usage is
          // consumed yet (e.g. Hunter's documented X-Credits-Used header), so
          // even a successful charge is unverified, never labeled measured.
          costMicrocents: this.nominalCostMicrocents,
          costAssumed: true,
          rawResponse: data as Record<string, unknown>,
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
