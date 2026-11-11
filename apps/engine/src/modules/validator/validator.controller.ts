import {
  GenerateValidationRequestSchema,
  SubmitWaitlistLeadRequestSchema,
  ValidationScorecardResponse,
} from '@leadloom/contracts';
import { ValidatorService, PublicSmokePage } from './validator.service';

export class ValidatorController {
  constructor(private readonly validatorService: ValidatorService) {}

  public async generate(workspaceId: string, body: unknown): Promise<{
    experimentId: string;
    pageUrl: string;
    scorecard: ValidationScorecardResponse;
  }> {
    const validated = GenerateValidationRequestSchema.parse(body);
    const result = await this.validatorService.generate(workspaceId, validated);
    return {
      experimentId: result.experimentId,
      pageUrl: result.pageUrl,
      scorecard: result.scorecard,
    };
  }

  public async getScorecard(experimentId: string, workspaceId?: string): Promise<ValidationScorecardResponse> {
    return this.validatorService.getScorecard(experimentId, workspaceId);
  }

  public async submitLead(
    slug: string,
    body: unknown
  ): Promise<{ success: boolean; totalWaitlist: number }> {
    const validated = SubmitWaitlistLeadRequestSchema.parse(body);
    return this.validatorService.submitLead(slug, validated);
  }

  /** Public smoke-page content; fetching it records one raw page load. */
  public async getPublicPage(slug: string): Promise<PublicSmokePage | undefined> {
    return this.validatorService.getPublicPage(slug);
  }
}
