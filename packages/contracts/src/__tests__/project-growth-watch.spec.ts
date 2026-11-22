import {describe,it,expect} from 'vitest';
import {CreateProjectGrowthWatchSchema,UpdateProjectGrowthWatchSchema,ProjectGrowthWatchSchema} from '../project-growth-watch.contract';
const id='00000000-0000-4000-8000-000000000001',request={requestId:id,experimentId:id,intervalMinutes:60};
describe('private growth watch boundaries',()=>{
 it('requires explicit bounded integer minutes and rejects execution options',()=>{
  expect(CreateProjectGrowthWatchSchema.parse(request)).toEqual(request);
  for(const value of[59,10081,60.5,'60',null,NaN,Infinity])expect(CreateProjectGrowthWatchSchema.safeParse({...request,intervalMinutes:value}).success).toBe(false);
  for(const extra of[{send:true},{workspaceId:id},{projectId:id},{provider:'external'},{authorizedBy:id},{state:'active'}])expect(CreateProjectGrowthWatchSchema.safeParse({...request,...extra}).success).toBe(false);
 });
 it('accepts only explicit active or paused configuration changes with a revision',()=>{
  expect(UpdateProjectGrowthWatchSchema.safeParse({state:'paused',expectedRevision:1}).success).toBe(true);
  for(const raw of[{state:'blocked',expectedRevision:1},{state:'active'},{state:'active',expectedRevision:0},{state:'active',expectedRevision:1.1},{state:'active',expectedRevision:1,experimentId:id}])expect(UpdateProjectGrowthWatchSchema.safeParse(raw).success).toBe(false);
 });
 it('refuses inconsistent blocked state in a response',()=>{
  const watch={id,projectId:id,experimentId:id,intervalMinutes:60,state:'active',revision:1,nextDueAt:'2026-11-22T06:00:00.000Z',lastCheckedAt:null,lastEntryId:null,blockedReason:null,createdAt:'2026-11-22T05:00:00.000Z',updatedAt:'2026-11-22T05:00:00.000Z'};
  expect(ProjectGrowthWatchSchema.safeParse(watch).success).toBe(true);
  expect(ProjectGrowthWatchSchema.safeParse({...watch,state:'blocked'}).success).toBe(false);
  expect(ProjectGrowthWatchSchema.safeParse({...watch,blockedReason:'access_changed'}).success).toBe(false);
  expect(ProjectGrowthWatchSchema.safeParse({...watch,state:'blocked',blockedReason:'access_changed'}).success).toBe(true);
 });
});
