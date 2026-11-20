import { BYOKProvider, WaterfallStepStatus } from '@leadloom/contracts';

/**
 * D2 BILLING-INTEGRITY CONTRACT (2026-11-20, main): an adapter must NOT
 * normalize a POST-SUBMISSION failure (timeout, connection reset, response
 * parse failure - any state where the provider may have processed and CHARGED
 * the request) into a returned error-status payload. Such failures must THROW
 * so the dispatch worker can classify the row outcome as UNKNOWN
 * (needs_review, never blind-retried). Only definitive provider responses
 * (the provider answered and reported failure/no-match) may become returned
 * error payloads. An error label alone NEVER proves zero charge and never
 * justifies a retry. Current adapters: audit against this rule is PENDING;
 * until then, billing inferences from returned error payloads are unproved.
 */
/** Thrown when a failure happens around a POSSIBLY-SUBMITTED provider request
 *  (timeout, connection reset, parse failure). The provider outcome and any
 *  charge are UNKNOWN; the dispatch worker must classify the row uncertain
 *  (needs_review), never write it as a known result, never blind-retry. */
export class ProviderOutcomeUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderOutcomeUnknownError';
  }
}

export interface ProviderExecutionInput {
  domain: string;
  /** Authenticated tenant scope. Person-level cache reuse is disabled without it. */
  workspaceId?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  title?: string;
}

export interface ProviderExecutionOutput {
  email: string | null;
  confidence: number;
  status: WaterfallStepStatus;
  verification?: 'deliverable' | 'risky' | 'catch_all' | 'undeliverable';
  rawResponse?: Record<string, unknown>;
  latencyMs: number;
  costMicrocents: number;
  /** TRUE when costMicrocents is an UNVERIFIED ESTIMATE at the nominal rate,
   *  not measured and NOT a proven maximum: the provider ANSWERED with an
   *  error (or no match) and its billing policy for that case is unknown -
   *  the real charge could be higher or lower. Budget accounting must never
   *  treat it as measured zero, and no consumer may use it as a spending
   *  ceiling guarantee. Absent/undefined: ordinary measured/nominal semantics. */
  costAssumed?: boolean;
  errorMessage?: string;
}

export abstract class BaseProviderAdapter {
  abstract readonly provider: BYOKProvider;
  abstract readonly nominalCostMicrocents: number;

  abstract execute(
    input: ProviderExecutionInput,
    apiKey?: string
  ): Promise<ProviderExecutionOutput>;
}
