import { BYOKProvider, WaterfallStepStatus } from '@leadloom/contracts';

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
