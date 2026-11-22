import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {ResearchLeadsService} from '../research-leads.service';
import {IntentFixtureService} from '../intent-fixture.service';
import {ResearchTableConflict} from '../research-row-store';
import {createApplication} from '../../../main';
import {issueSession} from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native research request receipts prevent duplicate retries across concurrency/restarts, bind input and kind, survive deletion and roll back with failures',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),requestId=randomUUID(),fn='research_receipt_'+randomUUID().replaceAll('-',''),key=Buffer.alloc(32,4);let app:any;
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Synthetic research retries'},{id:other,name:'Other research retries'}]});
  const service=new ResearchLeadsService(db),intent=new IntentFixtureService(db),text='We build Kubernetes software and hire engineers.';
  const saves=await Promise.all(Array.from({length:12},()=>service.saveAnalysis(ws,'retry.invalid',text,'pasted_text',requestId)));
  expect(new Set(saves.map(r=>r.rowId)).size).toBe(1);expect(saves.filter(r=>!r.replayed)).toHaveLength(1);const tableId=saves[0].tableId,rowId=saves[0].rowId;
  expect(await db.row.count({where:{tableId}})).toBe(1);expect(await db.cell.count({where:{tableId}})).toBe(11);expect((await db.table.findUnique({where:{id:tableId}}))?.rowCount).toBe(1);
  const before=await db.table.findUnique({where:{id:tableId}}),cells=await db.cell.findMany({where:{tableId}});
  expect((await new ResearchLeadsService(db).saveAnalysis(ws,'retry.invalid',text,'pasted_text',requestId)).replayed).toBe(true);expect(await db.table.findUnique({where:{id:tableId}})).toEqual(before);expect(await db.cell.findMany({where:{tableId}})).toEqual(cells);
  await expect(service.saveAnalysis(ws,'different.invalid',text,'pasted_text',requestId)).rejects.toBeInstanceOf(ResearchTableConflict);
  const fixture={company:'Sample',jobs:[{title:'Engineer'}]};await expect(intent.saveAnalysis(ws,fixture,requestId)).rejects.toBeInstanceOf(ResearchTableConflict);
  const fixtureId=randomUUID(),first=await intent.saveAnalysis(ws,fixture,fixtureId),second=await new IntentFixtureService(db).saveAnalysis(ws,{jobs:[{title:'Engineer'}],company:'Sample'},fixtureId);expect(first.ok&&second.ok&&first.rowId===second.rowId).toBe(true);expect(second.ok&&second.replayed).toBe(true);
  expect((await service.saveAnalysis(other,'retry.invalid',text,'pasted_text',requestId)).replayed).toBe(false);
  const deliberate=await service.saveAnalysis(ws,'retry.invalid',text,'pasted_text',randomUUID());expect(deliberate.rowId).not.toBe(rowId);
  const legacy=await Promise.all([service.saveAnalysis(ws,'legacy.invalid',text,'pasted_text'),service.saveAnalysis(ws,'legacy.invalid',text,'pasted_text')]);expect(legacy[0].rowId).not.toBe(legacy[1].rowId);
  const failedId=randomUUID(),beforeRows=await db.row.count({where:{tableId}}),beforeCount=(await db.table.findUnique({where:{id:tableId}}))?.rowCount;
  // Receipt insert fails after row/cells/count writes, proving the receipt belongs to the same transaction.
  await db.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='${failedId}'::uuid THEN RAISE EXCEPTION 'Synthetic private receipt failure'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON research_save_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  await expect(service.saveAnalysis(ws,'failed.invalid',text,'pasted_text',failedId)).rejects.toThrow();expect(await db.row.count({where:{tableId}})).toBe(beforeRows);expect((await db.table.findUnique({where:{id:tableId}}))?.rowCount).toBe(beforeCount);expect((await db.$queryRawUnsafe<any[]>('SELECT * FROM research_save_receipts WHERE workspace_id=$1::uuid AND request_id=$2::uuid',ws,failedId))).toEqual([]);
  await db.$executeRawUnsafe(`DROP TRIGGER ${fn} ON research_save_receipts`);await db.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);expect((await service.saveAnalysis(ws,'failed.invalid',text,'pasted_text',failedId)).replayed).toBe(false);
  app=await createApplication({sessionKey:key,researchLeads:service,intentFixture:intent} as any);const server=app.getHttpAdapter().getInstance(),headers={authorization:'Bearer '+issueSession({workspaceId:ws,userId:randomUUID(),role:'member'},key,3600).token};
  const post=(path:string,payload:any)=>server.inject({method:'POST',url:path,headers,payload});
  expect((await post('/research/website-signals/save',{domain:'retry.invalid',pageText:text,requestId})).json().replayed).toBe(true);expect((await post('/research/website-signals/save',{domain:'retry.invalid',pageText:text,requestId:'bad'})).statusCode).toBe(400);
  expect((await post('/research/intent-fixture/save',{fixture,requestId:fixtureId})).json().replayed).toBe(true);expect((await post('/research/intent-fixture/save',{fixture,requestId})).statusCode).toBe(409);
  await db.row.delete({where:{id:rowId}});await expect(service.saveAnalysis(ws,'retry.invalid',text,'pasted_text',requestId)).rejects.toThrow(/removed/);expect((await post('/research/website-signals/save',{domain:'retry.invalid',pageText:text,requestId})).statusCode).toBe(409);
  await db.table.delete({where:{id:tableId}});await expect(service.saveAnalysis(ws,'failed.invalid',text,'pasted_text',failedId)).rejects.toThrow(/removed/);
  expect((await db.$queryRawUnsafe<any[]>('SELECT count(*)::int AS n FROM research_save_receipts WHERE workspace_id=$1::uuid',ws))[0].n).toBe(4);
 }finally{await app?.close();await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fn} ON research_save_receipts`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});expect((await db.$queryRawUnsafe<any[]>('SELECT count(*)::int AS n FROM research_save_receipts WHERE workspace_id=$1::uuid',ws))[0].n).toBe(0);await db.$disconnect();}
},30000);
