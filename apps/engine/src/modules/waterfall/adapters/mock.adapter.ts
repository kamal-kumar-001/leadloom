import { BYOKProvider, WaterfallStepStatus } from '@leadloom/contracts';
import { BaseProviderAdapter, ProviderExecutionInput, ProviderExecutionOutput } from './base-provider.adapter';

export interface MockAdapterConfig {
  provider?: BYOKProvider;
  nominalCostMicrocents?: number;
  simulatedStatus?: WaterfallStepStatus;
  simulatedVerification?: 'deliverable' | 'risky' | 'catch_all' | 'undeliverable';
  simulatedConfidence?: number;
  simulatedEmail?: string | null;
  simulatedLatencyMs?: number;
  simulatedError?: string;
}

export class MockProviderAdapter extends BaseProviderAdapter {
  readonly provider: BYOKProvider;
  readonly nominalCostMicrocents: number;
  private config: MockAdapterConfig;
  public callCount = 0;

  constructor(config: MockAdapterConfig = {}) {
    super();
    this.config = config;
    this.provider = config.provider ?? 'apollo';
    this.nominalCostMicrocents = config.nominalCostMicrocents ?? 100;
  }

  setConfig(config: Partial<MockAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async execute(
    input: ProviderExecutionInput,
    _apiKey?: string
  ): Promise<ProviderExecutionOutput> {
    this.callCount += 1;
    const latencyMs = this.config.simulatedLatencyMs ?? 5;
    const status = this.config.simulatedStatus ?? 'hit';

    if (status === 'error' || status === 'rate_limited') {
      return {
        email: null,
        confidence: 0,
        status,
        latencyMs,
        costMicrocents: 0,
        errorMessage: this.config.simulatedError ?? `Mock provider ${status}`,
      };
    }

    if (status === 'miss') {
      return {
        email: null,
        confidence: 0,
        status: 'miss',
        latencyMs,
        costMicrocents: this.nominalCostMicrocents,
      };
    }

    const email =
      this.config.simulatedEmail !== undefined
        ? this.config.simulatedEmail
        : `${input.firstName?.toLowerCase() ?? 'lead'}@${input.domain}`;

    return {
      email,
      confidence: this.config.simulatedConfidence ?? 0.9,
      status: 'hit',
      verification: this.config.simulatedVerification ?? 'deliverable',
      latencyMs,
      costMicrocents: this.nominalCostMicrocents,
      rawResponse: { mock: true, domain: input.domain },
    };
  }
}
