import {describe,it,expect,vi} from 'vitest';
import {ProjectExperimentResultsService} from '../project-experiment-results.service';
const fixture=()=>({$queryRawUnsafe:vi.fn().mockResolvedValueOnce([{id:'experiment',project_id:'project',outreach_sent:0,replies:0,positive_replies:0}]).mockResolvedValueOnce([{slug:'private-fixture',status:'draft',visitors:2,stored_submissions:1}])});
describe('aggregate transaction composition',()=>{
 it('keeps the standalone read in one repeatable-read transaction',async()=>{
  const tx=fixture(),db={$transaction:vi.fn(async(fn:any,_options?:unknown)=>fn(tx))};
  const result=await new ProjectExperimentResultsService(db as any).read('workspace','project','experiment');
  expect(db.$transaction).toHaveBeenCalledOnce();expect(db.$transaction.mock.calls[0][1]).toEqual({isolationLevel:'RepeatableRead'});
  expect(result?.counts.pageLoads).toBe(2);expect(tx.$queryRawUnsafe).toHaveBeenCalledTimes(2);
 });
 it('uses only the supplied transaction when composed by another local operation',async()=>{
  const tx=fixture(),db={$transaction:vi.fn(()=>{throw Error('Nested transaction is forbidden');})};
  const result=await new ProjectExperimentResultsService(db as any).readInTransaction(tx as any,'workspace','project','experiment');
  expect(db.$transaction).not.toHaveBeenCalled();expect(result?.counts.storedSubmissions).toBe(1);
  expect(tx.$queryRawUnsafe.mock.calls[0].slice(1)).toEqual(['workspace','project','experiment']);
  expect(tx.$queryRawUnsafe.mock.calls[1].slice(1)).toEqual(['experiment']);
 });
 it('does not read pages for missing ownership and still refuses corrupt counters',async()=>{
  const missing={$queryRawUnsafe:vi.fn().mockResolvedValue([])},service=new ProjectExperimentResultsService({} as any);
  expect(await service.readInTransaction(missing as any,'workspace','project','experiment')).toBeNull();expect(missing.$queryRawUnsafe).toHaveBeenCalledOnce();
  const invalid=fixture();invalid.$queryRawUnsafe.mockReset().mockResolvedValueOnce([{id:'experiment',project_id:'project',outreach_sent:0,replies:1,positive_replies:0}]).mockResolvedValueOnce([]);
  await expect(service.readInTransaction(invalid as any,'workspace','project','experiment')).rejects.toThrow('inconsistent');
 });
});
