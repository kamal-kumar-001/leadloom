import { BYOKProvider } from '@leadloom/contracts';
import { BaseProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput, ProviderOutcomeUnknownError } from './base-provider.adapter.js';

export class HunterAdapter extends BaseProviderAdapter {
  readonly provider: BYOKProvider = 'hunter';
  readonly nominalCostMicrocents: number = 300; // ~$0.003

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
      const url = new URL('https://api.hunter.io/v2/email-finder');
      url.searchParams.set('domain', input.domain);
      if (input.firstName) url.searchParams.set('first_name', input.firstName);
      if (input.lastName) url.searchParams.set('last_name', input.lastName);
      url.searchParams.set('api_key', apiKey);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
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
          errorMessage: 'Hunter rate limit reached (HTTP 429)',
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
          errorMessage: `Hunter error HTTP ${response.status}`,
        };
      }

      const data = await response.json() as {
        data?: {
          email?: string;
          score?: number;
          verification?: { status?: string };
        };
      };

      const found = data.data;
      if (found?.email) {
        const score = (found.score ?? 80) / 100;
        let verification: 'deliverable' | 'risky' | 'catch_all' | 'undeliverable' = 'deliverable';
        const vStatus = found.verification?.status;
        if (vStatus === 'accept_all') verification = 'catch_all';
        else if (vStatus === 'risky') verification = 'risky';
        else if (vStatus === 'invalid') verification = 'undeliverable';

        return {
          email: found.email,
          confidence: score,
          status: 'hit',
          verification,
          latencyMs,
          // ESTIMATE at the nominal rate: no provider-reported usage is
          // consumed yet (e.g. Hunter's documented X-Credits-Used header), so
          // even a successful charge is unverified, never labeled measured.
          costMicrocents: this.nominalCostMicrocents,
          costAssumed: true,
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
