import {
  DispatchWaterfallRequestSchema,
  PreFlightEstimateRequestSchema,
  PreFlightEstimateResponse,
  DispatchWaterfallResponse,
} from '@leadloom/contracts';
import { WaterfallService } from './waterfall.service';

export class WaterfallController {
  constructor(private readonly waterfallService: WaterfallService) {}

  public async getPreFlightEstimate(body: unknown): Promise<PreFlightEstimateResponse> {
    const validated = PreFlightEstimateRequestSchema.parse(body);
    return this.waterfallService.estimatePreFlight(validated);
  }

  public async dispatch(body: unknown, workspaceId?: string): Promise<DispatchWaterfallResponse> {
    const validated = DispatchWaterfallRequestSchema.parse(body);
    const resolvedWorkspaceId =
      workspaceId ?? (typeof body === 'object' && body !== null ? (body as any).workspaceId : undefined);
    return this.waterfallService.dispatchWaterfall(validated, resolvedWorkspaceId);
  }
}
