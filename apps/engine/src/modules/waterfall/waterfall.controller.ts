import {
  DispatchWaterfallRequestSchema,
  PreFlightEstimateRequestSchema,
  PreFlightEstimateResponse,
  DispatchWaterfallResponse,
} from '@leadloom/contracts';
import { WaterfallService } from './waterfall.service';

export class WaterfallDispatchTenantMismatchError extends Error {
  constructor() {
    super('workspaceId does not match the authenticated session');
    this.name = 'WaterfallDispatchTenantMismatchError';
  }
}

export class WaterfallController {
  constructor(private readonly waterfallService: WaterfallService) {}

  public async getPreFlightEstimate(body: unknown): Promise<PreFlightEstimateResponse> {
    const validated = PreFlightEstimateRequestSchema.parse(body);
    return this.waterfallService.estimatePreFlight(validated);
  }

  public async dispatch(body: unknown, workspaceId?: string): Promise<DispatchWaterfallResponse> {
    const validated = DispatchWaterfallRequestSchema.parse(body);
    // Tenant binding comes only from the authenticated session. A workspaceId in
    // the request body is a claim, not an identity: a mismatch is rejected
    // outright (same pattern as /outbound/jobs), never silently preferred.
    const claimed =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>).workspaceId : undefined;
    if (claimed !== undefined && claimed !== workspaceId) {
      throw new WaterfallDispatchTenantMismatchError();
    }
    return this.waterfallService.dispatchWaterfall(validated, workspaceId);
  }

  public async getJobUncertainRows(jobId: string, workspaceId?: string) {
    if (!workspaceId) throw new WaterfallDispatchTenantMismatchError();
    return this.waterfallService.getJobUncertainRows(workspaceId, jobId);
  }

  public async getJobStatus(jobId: string, workspaceId?: string) {
    if (!workspaceId) throw new WaterfallDispatchTenantMismatchError();
    return this.waterfallService.getJobStatus(workspaceId, jobId);
  }
}
