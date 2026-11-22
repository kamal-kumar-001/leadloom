import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {PrismaDispatchDatabase} from '../../outbound/prisma-database';
import {DurableWaterfallService} from '../durable-waterfall.service';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
async function waitForBlockedWriter(db:PrismaClient,pid:number){
 for(let i=0;i<100;i++){
  const rows=await db.$queryRawUnsafe<Array<{blocked:boolean}>>("SELECT wait_event_type='Lock' AS blocked FROM pg_stat_activity WHERE pid=$1",pid);
  if(rows[0]?.blocked)return;
  await new Promise(r=>setTimeout(r,10));
 }
 throw new Error('Expected writer to block on native transaction lock');
}
const success:any={value:'synthetic@example.invalid',status:'success',confidence:0.97,trace:[],telemetry:{provider_attributed:'hunter',tier:1,cost_microcents:0,latency_ms:1}};
for(const phase of ['claim','apply'] as const)for(const action of ['touch','delete'] as const)it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)(`native ${phase} and table ${action} cannot deadlock through child run rows`,async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),uid=randomUUID();let release=()=>{};
 try{
  await db.workspace.create({data:{id:ws,name:'Native worker lock-order fixture'}});await db.user.create({data:{id:uid,workspaceId:ws,email:uid+'@example.invalid',role:'member'}});
  const table=await db.table.create({data:{workspaceId:ws,name:'Worker lock fixture'}}),columns=[];
  for(const[i,name]of['Domain','First','Last','Result'].entries())columns.push(await db.column.create({data:{tableId:table.id,name,type:i===3?'waterfall':'text',orderIndex:i}}));
  await db.column.update({where:{id:columns[3].id},data:{config:{inputColumns:{domain:columns[0].id,firstName:columns[1].id,lastName:columns[2].id}}}});
  const source=await db.row.create({data:{tableId:table.id,orderIndex:0}});for(const[i,value]of['example.invalid','Synthetic','Fixture'].entries())await db.cell.create({data:{tableId:table.id,rowId:source.id,columnId:columns[i].id,value}});
  const native=new PrismaDispatchDatabase(db),service=new DurableWaterfallService(native),receipt=await service.submit(ws,uid,{requestId:randomUUID(),columnId:columns[3].id,rowIds:[source.id]});
  let attempt:any;if(phase==='apply'){attempt=await service.claim(ws);await service.record(ws,attempt.id,attempt.attemptId,success);}
  let enter!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);
  const gated={transaction:(fn:any)=>native.transaction(tx=>fn({query:async(sql:string,args:any[])=>{const result=await tx.query(sql,args);if(sql.includes('FOR UPDATE OF r')){enter();await gate;}return result;}}))};
  const worker=phase==='claim'?new DurableWaterfallService(gated).claim(ws):new DurableWaterfallService(gated).apply(ws,attempt.id,attempt.attemptId);
  await entered;
  let writerPid=0;let started!:()=>void;const ready=new Promise<void>(r=>started=r);
  const writing=db.$transaction(async tx=>{writerPid=(await tx.$queryRawUnsafe<Array<{pid:number}>>('SELECT pg_backend_pid() AS pid'))[0].pid;started();await tx.$queryRawUnsafe('SELECT id FROM tables WHERE id=$1::uuid FOR UPDATE',table.id);if(action==='delete')await tx.table.delete({where:{id:table.id}});else await tx.$executeRawUnsafe('UPDATE waterfall_run_rows SET finished_at=finished_at WHERE run_id=$1::uuid',receipt.runId);});
  await ready;await waitForBlockedWriter(db,writerPid);release();const results=await Promise.allSettled([worker,writing]);
  console.log(`NATIVE ${phase} ORDER RESULTS`,results.map(r=>r.status==='fulfilled'?'fulfilled':String(r.reason)));expect(results.every(r=>r.status==='fulfilled')).toBe(true);
  if(action==='delete'){expect(await service.read(ws,receipt.runId)).toBeNull();expect(await db.cell.count({where:{tableId:table.id}})).toBe(0);}else expect((await service.read(ws,receipt.runId))?.rows[0].state).toBe(phase==='claim'?'running':'applied');
 }finally{release();await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
},15000);
for(const phase of ['claim','apply'] as const)it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)(`native ${phase} rechecks role changed after unlocked candidate lookup`,async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),uid=randomUUID();let release=()=>{};
 try{
  await db.workspace.create({data:{id:ws,name:'Native role interleaving'}});await db.user.create({data:{id:uid,workspaceId:ws,email:uid+'@example.invalid',role:'member'}});
  const table=await db.table.create({data:{workspaceId:ws,name:'Role fixture'}}),columns=[];
  for(const[i,name]of['Domain','First','Last','Result'].entries())columns.push(await db.column.create({data:{tableId:table.id,name,type:i===3?'waterfall':'text',orderIndex:i}}));
  await db.column.update({where:{id:columns[3].id},data:{config:{inputColumns:{domain:columns[0].id,firstName:columns[1].id,lastName:columns[2].id}}}});
  const source=await db.row.create({data:{tableId:table.id,orderIndex:0}});for(const[i,value]of['example.invalid','Synthetic','Fixture'].entries())await db.cell.create({data:{tableId:table.id,rowId:source.id,columnId:columns[i].id,value}});
  const native=new PrismaDispatchDatabase(db),service=new DurableWaterfallService(native),receipt=await service.submit(ws,uid,{requestId:randomUUID(),columnId:columns[3].id,rowIds:[source.id]});
  let attempt:any;if(phase==='apply'){attempt=await service.claim(ws);await service.record(ws,attempt.id,attempt.attemptId,success);}
  let enter!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);
  const gated={transaction:(fn:any)=>native.transaction(tx=>fn({query:async(sql:string,args:any[])=>{const result=await tx.query(sql,args);if(sql.startsWith('SELECT p.table_id,p.requested_by')){enter();await gate;}return result;}}))};
  const worker=phase==='claim'?new DurableWaterfallService(gated).claim(ws):new DurableWaterfallService(gated).apply(ws,attempt.id,attempt.attemptId);
  await entered;await db.user.update({where:{id:uid},data:{role:'read_only'}});release();expect(await worker).toBe(phase==='claim'?null:'conflict');
  expect((await service.read(ws,receipt.runId))?.rows[0].state).toBe(phase==='claim'?'queued':'conflict');expect(await db.cell.findUnique({where:{rowId_columnId:{rowId:source.id,columnId:columns[3].id}}})).toBeNull();
 }finally{release();await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
},15000);
