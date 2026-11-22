import {describe,it,expect} from 'vitest';
import {ValidationScorecardMetricsSchema} from '../src/validation.contract';
const rate=ValidationScorecardMetricsSchema.shape.pageConversionRate;
describe('observed signup-to-load rate contract',()=>{
 it('accepts unavailable and comparable rates without coercion',()=>{for(const value of [null,0,0.5,1])expect(rate.parse(value)).toBe(value);});
 it('rejects missing, malformed, nonfinite and out-of-range rates',()=>{for(const value of [undefined,'0.5',-0.01,1.01,NaN,Infinity])expect(rate.safeParse(value).success).toBe(false);});
});
