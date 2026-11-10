import {describe,it,expect} from 'vitest';
import {TableMetadataSchema,PreFlightEstimateResponseSchema,ValidationScorecardResponseSchema,MailboxHealthStatusSchema} from '../src/index';
import * as mocks from '../src/mocks';
describe('Shared fixtures obey the same contracts as real API payloads',()=>{
 it('validates grid metadata',()=>{expect(()=>TableMetadataSchema.parse(mocks.MOCK_TABLE_METADATA)).not.toThrow();});
 it('validates preflight payload',()=>{expect(()=>PreFlightEstimateResponseSchema.parse(mocks.MOCK_PREFLIGHT_RESPONSE)).not.toThrow();});
 it('validates validation scorecard',()=>{expect(()=>ValidationScorecardResponseSchema.parse(mocks.MOCK_VALIDATION_SCORECARD)).not.toThrow();});
 it('validates every mailbox fixture',()=>{for(const mailbox of mocks.MOCK_MAILBOX_HEALTH)expect(()=>MailboxHealthStatusSchema.parse(mailbox)).not.toThrow();});
});
