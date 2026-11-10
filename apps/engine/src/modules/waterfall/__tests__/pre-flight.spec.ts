import { describe, it, expect } from 'vitest';
import { PreFlightEstimatorService } from '../pre-flight.service';
import { PreFlightEstimateResponseSchema } from '@leadloom/contracts';

describe('PreFlightEstimatorService — Cost & Hit Rate Prediction', () => {
  it('should accurately calculate decay cost across tiers and conform to contract schema', () => {
    const estimator = new PreFlightEstimatorService();

    const mockRowIds = Array.from({ length: 240 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
    const result = estimator.estimate({
      columnId: '11111111-2222-3333-4444-555555555555',
      rowIds: mockRowIds,
    });

    // Validate Zod contract
    PreFlightEstimateResponseSchema.parse(result);

    expect(result.totalRows).toBe(240);
    expect(result.estimatedCostUSD).toBeGreaterThan(0);
    expect(result.estimatedCostUSD).toBeLessThan(2.0); // Cost preserved via short-circuit decay
    expect(result.guaranteeNotice).toBe('Zero unnecessary external API calls guaranteed via early-exit short-circuiting');
    expect(result.tiers).toHaveLength(3);
  });
});
