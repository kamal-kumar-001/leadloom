import {
  GenerateValidationRequestSchema,
  SubmitWaitlistLeadRequestSchema,
  ValidationScorecardResponse,
} from '@leadloom/contracts';
import { ValidatorService } from './validator.service';

export class ValidatorController {
  constructor(private readonly validatorService: ValidatorService) {}

  public async generate(body: unknown): Promise<{
    experimentId: string;
    pageUrl: string;
    scorecard: ValidationScorecardResponse;
  }> {
    const validated = GenerateValidationRequestSchema.parse(body);
    const result = this.validatorService.generate(validated);
    return {
      experimentId: result.experimentId,
      pageUrl: result.pageUrl,
      scorecard: result.scorecard,
    };
  }

  public async getScorecard(experimentId: string): Promise<ValidationScorecardResponse> {
    return this.validatorService.getScorecard(experimentId);
  }

  public async submitLead(
    slug: string,
    body: unknown
  ): Promise<{ success: boolean; totalWaitlist: number }> {
    const validated = SubmitWaitlistLeadRequestSchema.parse(body);
    return this.validatorService.submitLead(slug, validated);
  }
}
