import { describe, it, expect } from 'vitest';
import { TableExportService, TableExportLimit } from '../table-export.service';
import { createApplication } from '../../../main';
import { issueSession } from '../../auth/issuer';
import { randomUUID } from 'node:crypto';
function fixture(overrides:any={}) {
 const tx:any={table:{findFirst:async()=>({id:'table'})},column:{findMany:async()=>[{id:'c1',name:'Name'},{id:'c2',name:'Notes'}]},row:{findMany:async()=>[{id:'r1'},{id:'r2'}]},cell:{findMany:async()=>[{rowId:'r1',columnId:'c1',value:'00012'},{rowId:'r1',columnId:'c2',value:'Line "one"\ntwo'},{rowId:'r2',columnId:'c2',value:'  =SUM(A1)'}]},$queryRawUnsafe:async()=>[{bytes:100,cell_count:3}],...overrides};
 let options:any;
 return {db:{$transaction:async(fn:any,opts:any)=>{options=opts;return fn(tx);}},options:()=>options};
}
describe('saved table CSV export',()=>{
 it('exports ordered values by IDs with complete rows, escaped quotes/newlines, empty cells and formula protection',async()=>{
  const f=fixture();const result=await new TableExportService(f.db).export('ws','table');
  expect(result).toEqual({rowCount:2,csv:'"Name","Notes"\r\n"00012","Line ""one""\ntwo"\r\n"","\'  =SUM(A1)"'});
  expect(f.options()).toEqual({isolationLevel:'RepeatableRead',timeout:15000});
 });
 it('does not return foreign tables or silent partial exports over row/column/value/cell budgets',async()=>{
  expect(await new TableExportService(fixture({table:{findFirst:async()=>null}}).db).export('foreign','table')).toBeNull();
  for(const change of [{row:{findMany:async()=>Array.from({length:5001},(_,i)=>({id:String(i)}))}},{column:{findMany:async()=>Array.from({length:101},(_,i)=>({id:String(i),name:String(i)}))}},{$queryRawUnsafe:async()=>[{bytes:2000001,cell_count:3}]},{$queryRawUnsafe:async()=>[{bytes:1,cell_count:100001}]}])await expect(new TableExportService(fixture(change).db).export('ws','table')).rejects.toBeInstanceOf(TableExportLimit);
 });
 it('allows authenticated read-only download and returns honest errors with no partial content',async()=>{
  const key=Buffer.alloc(32,8),table=randomUUID(),ws=randomUUID();let mode='ok';
  const app=await createApplication({sessionKey:key,tableExports:{export:async(workspace:string)=>{if(mode==='limit')throw new TableExportLimit();if(mode==='fail')throw Error('Synthetic failure');if(workspace!==ws)return null;return{csv:'"Name"\r\n"Synthetic"',rowCount:1};}}} as any);const server=app.getHttpAdapter().getInstance();
  const get=(workspaceId=ws)=>server.inject({method:'GET',url:'/workspace/tables/'+table+'/export',headers:{authorization:'Bearer '+issueSession({userId:randomUUID(),workspaceId,role:'read_only'},key,3600).token}});
  try{
   const response=await get();expect(response.statusCode).toBe(200);expect(response.headers['content-type']).toContain('text/csv');expect(response.headers['content-disposition']).toContain('.csv');expect(response.headers['cache-control']).toBe('no-store');expect(response.body).toContain('Synthetic');
   expect((await get(randomUUID())).statusCode).toBe(404);expect((await server.inject({method:'GET',url:'/workspace/tables/'+table+'/export'})).statusCode).toBe(401);
   mode='limit';expect((await get()).statusCode).toBe(413);mode='fail';expect((await get()).statusCode).toBe(503);
  }finally{await app.close();}
 });
});
