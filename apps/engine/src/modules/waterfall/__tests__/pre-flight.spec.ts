import { describe, it, expect } from 'vitest';
import { PreFlightEstimatorService,PreFlightUnavailableError } from '../pre-flight.service';
import { PreFlightEstimateResponseSchema } from '@leadloom/contracts';

describe('PreFlightEstimatorService: explicit assumption simulation only', () => {
 it('refuses invented default provider prices and hit rates',()=>{expect(()=>new PreFlightEstimatorService().estimate({columnId:'11111111-2222-3333-4444-555555555555',rowIds:['11111111-2222-3333-4444-555555555555']})).toThrow(PreFlightUnavailableError);});
  it('should accurately calculate decay cost across tiers and conform to contract schema', () => {
    const estimator = new PreFlightEstimatorService();

    const mockRowIds = Array.from({ length: 240 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
    const result = estimator.estimate({
      columnId: '11111111-2222-3333-4444-555555555555',
      rowIds: mockRowIds,
    },[{tierIndex:1,provider:'apollo',unitCostUSD:0.001,estimatedHitRate:0.58},{tierIndex:2,provider:'hunter',unitCostUSD:0.003,estimatedHitRate:0.28},{tierIndex:3,provider:'dropcontact',unitCostUSD:0.02,estimatedHitRate:0.1}]);

    // Validate Zod contract
    PreFlightEstimateResponseSchema.parse(result);

    expect(result.totalRows).toBe(240);
    expect(result.estimatedCostUSD).toBeGreaterThan(0);
    expect(result.estimatedCostUSD).toBeLessThan(2.0); // Cost preserved via short-circuit decay
    expect(result.costBasis).toBe('configured-assumptions');
    expect(result.executionNote).toContain('tier order');
    // No unsupported claims may come back: no call-count guarantee, and no
    // invented time estimate (withheld until a measured latency model exists).
    expect(result).not.toHaveProperty('estimatedSeconds');
    expect(JSON.stringify(result)).not.toContain('guaranteed');
    expect(result.guaranteeNotice).toContain('caller-supplied assumptions');
    expect(result.tiers).toHaveLength(3);
  });
});
