import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {ResearchLeadsService,RESEARCH_TABLE_NAME} from '../research-leads.service';
import {IntentFixtureService,INTENT_TABLE_NAME} from '../intent-fixture.service';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native research writes serialize first saves and commit complete cells/order/count together; DB failures roll back and conflicts fail closed',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),tag=randomUUID().replaceAll('-',''),fn='synthetic_research_'+tag;
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Synthetic atomic research'},{id:other,name:'Other research workspace'}]});
  await db.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.value='"fetched_url"'::jsonb AND EXISTS(SELECT 1 FROM tables WHERE id=NEW.table_id AND workspace_id='${ws}'::uuid) THEN RAISE EXCEPTION 'synthetic research cell failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON cells FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  const svc=new ResearchLeadsService(db),intent=new IntentFixtureService(db),text='We build Kubernetes developer API software and are hiring engineers.';
  await expect(svc.saveAnalysis(ws,'new-failure.invalid',text,'fetched_url')).rejects.toThrow();expect(await db.table.count({where:{workspaceId:ws}})).toBe(0);expect(await db.row.count({where:{table:{workspaceId:ws}}})).toBe(0);
  const results=await Promise.all(Array.from({length:16},(_,i)=>svc.saveAnalysis(ws,'company'+i+'.invalid',text,'pasted_text')));expect(new Set(results.map(r=>r.tableId)).size).toBe(1);const tableId=results[0].tableId;
  expect(await db.table.count({where:{workspaceId:ws,name:RESEARCH_TABLE_NAME}})).toBe(1);expect((await db.table.findUnique({where:{id:tableId}}))?.rowCount).toBe(16);expect(await db.cell.count({where:{tableId}})).toBe(176);expect((await db.row.findMany({where:{tableId},orderBy:{orderIndex:'asc'}})).map(r=>r.orderIndex)).toEqual(Array.from({length:16},(_,i)=>i));
  await expect(svc.saveAnalysis(ws,'existing-failure.invalid',text,'fetched_url')).rejects.toThrow();expect(await db.row.count({where:{tableId}})).toBe(16);expect(await db.cell.count({where:{tableId}})).toBe(176);expect((await db.table.findUnique({where:{id:tableId}}))?.rowCount).toBe(16);
  const fixture={company:'Synthetic fixture company',jobs:[{title:'Engineer'}]};const signals=await Promise.all(Array.from({length:8},()=>intent.saveAnalysis(ws,fixture)));expect(signals.every(r=>r.ok)).toBe(true);const signalTable=await db.table.findFirst({where:{workspaceId:ws,name:INTENT_TABLE_NAME}});expect(signalTable?.rowCount).toBe(8);expect(await db.cell.count({where:{tableId:signalTable!.id}})).toBe(72);expect((await intent.listAnalyses(ws))[0].values.Source).toBe('fixture_hiring_board_sample');
  expect(await svc.listAnalyses(other)).toEqual([]);await svc.saveAnalysis(other,'other.invalid',text,'pasted_text');expect((await svc.listAnalyses(other))).toHaveLength(1);expect((await svc.listAnalyses(ws))).toHaveLength(16);
  await db.row.deleteMany({where:{tableId,orderIndex:5}});await db.table.update({where:{id:tableId},data:{rowCount:999}});await svc.saveAnalysis(ws,'after-gap.invalid',text,'pasted_text');expect((await db.row.findMany({where:{tableId},orderBy:{orderIndex:'desc'},take:1}))[0].orderIndex).toBe(16);expect((await db.table.findUnique({where:{id:tableId}}))?.rowCount).toBe(16);
  await db.column.updateMany({where:{tableId,name:'Domain'},data:{name:'Renamed Domain'}});await expect(svc.saveAnalysis(ws,'schema-conflict.invalid',text,'pasted_text')).rejects.toThrow(/columns changed/);expect(await db.row.count({where:{tableId}})).toBe(16);await db.column.updateMany({where:{tableId,name:'Renamed Domain'},data:{name:'Domain'}});
  await db.table.create({data:{workspaceId:ws,name:RESEARCH_TABLE_NAME}});await expect(svc.saveAnalysis(ws,'duplicate.invalid',text,'pasted_text')).rejects.toThrow(/Multiple research tables/);await expect(svc.listAnalyses(ws)).rejects.toThrow(/Multiple research tables/);expect(await db.row.count({where:{tableId}})).toBe(16);
 }finally{await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fn} ON cells`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});await db.$disconnect();}
},30000);
