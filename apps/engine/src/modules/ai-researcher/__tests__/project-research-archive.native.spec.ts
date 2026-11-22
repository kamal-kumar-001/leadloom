import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {ProjectResearchArchive,ResearchCursorInvalid} from '../project-research-archive';
import {ResearchLeadsService,RESEARCH_TABLE_NAME} from '../research-leads.service';
import {IntentFixtureService} from '../intent-fixture.service';
import {ProjectResearchIndexQuerySchema} from '@leadloom/contracts';
import {ProjectRegistryService,PrismaProjectRegistryStore} from '../../project-context/project-registry.service';
import {AgentTokenService,InMemoryAgentTokenStore} from '../../auth/agent-token.service';
import {issueSession} from '../../auth/issuer';
import {createApplication} from '../../../main';
const url=process.env.LEADLOOM_TEST_DATABASE_URL,run=process.env.LEADLOOM_INTEGRATION==='1'&&Boolean(url);
describe.runIf(run)('native targeted saved research archive',()=>{
 let db:PrismaClient,service:ResearchLeadsService,intent:IntentFixtureService,app:any,server:any,tokens:AgentTokenService,reader:any,context:any,unbound:any;
 const ws=randomUUID(),other=randomUUID(),a=randomUUID(),b=randomUUID(),foreign=randomUUID(),uid=randomUUID(),key=Buffer.alloc(32,3);
 let old:any,beta:any,legacy:any,fixture:any,customColumn:string,reasonColumn:string;
 const query=(q='',cursor?:string,limit=10)=>ProjectResearchIndexQuerySchema.parse({kind:'website',q,cursor,limit});
 const human=()=>issueSession({userId:uid,workspaceId:ws,role:'member'},key,3600).token;
 const get=(path:string,token=reader.token)=>server.inject({method:'GET',url:path,headers:{authorization:'Bearer '+token}});
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});service=new ResearchLeadsService(db);intent=new IntentFixtureService(db);
  await db.workspace.createMany({data:[{id:ws,name:'Archive fixture'},{id:other,name:'Foreign archive'}]});await db.user.create({data:{id:uid,workspaceId:ws,email:uid+'@example.invalid'}});
  for(const [id,workspaceId,slug]of [[a,ws,'archive-alpha'],[b,ws,'archive-beta'],[foreign,other,'archive-foreign']])await db.$executeRawUnsafe('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,$3,$3)',id,workspaceId,slug);
  old=await service.saveAnalysis(ws,'old-needle.invalid','Kubernetes and hiring engineers','pasted_text',randomUUID(),a);
  for(let i=0;i<54;i++)await service.saveAnalysis(ws,'newer-'+i+'.invalid','Docker and pricing','pasted_text',randomUUID(),a);
  beta=await service.saveAnalysis(ws,'beta-private.invalid','Redis','pasted_text',randomUUID(),b);legacy=await service.saveAnalysis(ws,'unassigned-private.invalid','React','pasted_text',randomUUID());
  fixture=await intent.saveAnalysis(ws,{company:'Archive hiring fixture',jobs:[{title:'Synthetic fixture engineer'}]},randomUUID(),a);
  const col=await db.column.findFirst({where:{tableId:old.tableId,name:'Relevance reasons'}});reasonColumn=col!.id;
  await db.cell.updateMany({where:{rowId:old.rowId,columnId:reasonColumn},data:{value:'old-saved-detail-marker '+('x'.repeat(8000))}});
  customColumn=randomUUID();await db.column.create({data:{id:customColumn,tableId:old.tableId,name:'Custom private field',type:'text',orderIndex:20}});await db.cell.create({data:{tableId:old.tableId,rowId:old.rowId,columnId:customColumn,value:'excluded-custom-marker'}});
  const store=new InMemoryAgentTokenStore();tokens=new AgentTokenService(store);store.users.set(uid,{role:'member',disabledAt:null});store.workspaces.set(ws,{active:true});
  reader=await tokens.issue(ws,uid,{name:'Archive reader',projectId:a,scopes:['project:research:read']});context=await tokens.issue(ws,uid,{name:'Context only',projectId:a,scopes:['context:read']});unbound=await tokens.issue(ws,uid,{name:'Unbound research',scopes:['project:research:read']});
  app=await createApplication({sessionKey:key,researchLeads:service,intentFixture:intent,projectRegistry:new ProjectRegistryService(new PrismaProjectRegistryStore(db)),agentTokens:tokens} as any);server=app.getHttpAdapter().getInstance();
 },30000);
 afterAll(async()=>{await app?.close();await db?.workspace.deleteMany({where:{id:{in:[ws,other]}}});await db?.$disconnect();});
 it('reaches older rows outside the legacy newest50, returns bounded summary first and exact detail only on request',async()=>{
  expect((await service.listAnalyses(ws,a)).some(r=>r.rowId===old.rowId)).toBe(false);
  const page=await service.searchProjectAnalyses(ws,a,query('old-saved-detail-marker'));
  expect(page.items).toHaveLength(1);expect(page.items[0]).toMatchObject({rowId:old.rowId,projectId:a,kind:'website',title:'old-needle.invalid'});expect(page.items[0].excerpt).toHaveLength(240);expect(page.items[0]).not.toHaveProperty('values');
  expect(JSON.stringify(page)).not.toContain('x'.repeat(241));expect(JSON.stringify(page)).not.toContain('excluded-custom-marker');
  const detail=await service.getProjectAnalysis(ws,a,old.rowId);expect(detail!.values['Relevance reasons']).toBe('old-saved-detail-marker '+('x'.repeat(8000)));expect(detail!.values).not.toHaveProperty('Custom private field');
  expect((await service.searchProjectAnalyses(ws,a,query('excluded-custom-marker'))).items).toEqual([]);
 });
 it('keyset traversal covers all55 exactly once, including identical millisecond save times',async()=>{
  await db.$executeRawUnsafe("UPDATE research_row_projects SET created_at='2026-11-22T02:40:00.123Z' WHERE project_id=$1::uuid AND kind='website'",a);
  let cursor:string|undefined,ids:string[]=[];let n=0;
  do{const page=await service.searchProjectAnalyses(ws,a,query('',cursor));ids.push(...page.items.map(r=>r.rowId));cursor=page.nextCursor??undefined;expect(++n).toBeLessThan(10);}while(cursor);
  expect(ids).toHaveLength(55);expect(new Set(ids).size).toBe(55);expect(ids).toContain(old.rowId);expect(ids).not.toContain(beta.rowId);expect(ids).not.toContain(legacy.rowId);
 });
 it('binds a cursor to its workspace, project, kind and search without treating it as authorization',async()=>{
  const first=await service.searchProjectAnalyses(ws,a,query('',undefined,1));expect(first.nextCursor).toBeTruthy();
  for(const [workspaceId,projectId,q]of [[ws,b,''],[other,a,''],[ws,a,'changed']])await expect(service.searchProjectAnalyses(workspaceId,projectId,query(q,first.nextCursor!))).rejects.toBeInstanceOf(ResearchCursorInvalid);
  await expect(intent.searchProjectAnalyses(ws,a,ProjectResearchIndexQuerySchema.parse({kind:'intent-fixture',cursor:first.nextCursor}))).rejects.toBeInstanceOf(ResearchCursorInvalid);
  await expect(service.searchProjectAnalyses(ws,a,query('','not-json'))).rejects.toBeInstanceOf(ResearchCursorInvalid);
 });
 it('retrieves explicit ownership after a table rename, without inferring ownership from names',async()=>{
  await db.table.update({where:{id:old.tableId},data:{name:'Renamed saved research fixture'}});
  try{expect((await service.searchProjectAnalyses(ws,a,query('old-needle'))).items.map(r=>r.rowId)).toEqual([old.rowId]);expect((await service.getProjectAnalysis(ws,a,old.rowId))!.rowId).toBe(old.rowId);}
  finally{await db.table.update({where:{id:old.tableId},data:{name:RESEARCH_TABLE_NAME}});}
 });
 it('HTTP reads enforce token binding, same-workspace human identity, exact row/kind and no-store responses',async()=>{
  const page=await get('/agent/project/research/index?kind=website&q=old-needle');expect(page.statusCode).toBe(200);expect(page.headers['cache-control']).toBe('no-store');expect(page.json().items.map((r:any)=>r.rowId)).toEqual([old.rowId]);
  const detailPath='/agent/project/research/records/'+old.rowId+'?kind=website';expect((await get(detailPath)).json().values.Domain).toBe('old-needle.invalid');
  for(const rowId of [beta.rowId,legacy.rowId,randomUUID()])expect((await get('/agent/project/research/records/'+rowId+'?kind=website')).statusCode).toBe(404);
  expect((await get('/agent/project/research/records/'+old.rowId+'?kind=intent-fixture')).statusCode).toBe(404);
  for(const token of [context.token,unbound.token,human()])expect((await get('/agent/project/research/index?kind=website',token)).statusCode).toBe(403);
  expect((await get('/agent/project/research/index?kind=website&projectId='+b)).statusCode).toBe(400);expect((await get('/agent/project/research/index?kind=website&limit=21')).statusCode).toBe(400);
  expect((await get('/research/records?projectId='+a+'&kind=website&q=old-needle',human())).json().items[0].rowId).toBe(old.rowId);
  expect((await get('/research/records/'+old.rowId+'?projectId='+a+'&kind=website',human())).json().values.Domain).toBe('old-needle.invalid');
  expect((await get('/research/records?projectId='+foreign+'&kind=website',human())).statusCode).toBe(404);
  expect((await get('/research/records?projectId='+a+'&kind=website')).statusCode).toBe(403);
  const fixturePage=await get('/agent/project/research/index?kind=intent-fixture');expect(fixturePage.json().items[0]).toMatchObject({kind:'intent-fixture',source:'fixture_hiring_board_sample'});expect((await get('/agent/project/research/records/'+fixture.rowId+'?kind=intent-fixture')).json().values.Caveat).toContain('not a live feed');
 });
 it('schema ambiguity and oversized detail are refused instead of exposing custom fields or silently truncating details',async()=>{
  const duplicate=await db.column.create({data:{tableId:old.tableId,name:'Domain',type:'text',orderIndex:21}});
  try{expect((await get('/agent/project/research/index?kind=website&q=old-needle')).statusCode).toBe(409);}
  finally{await db.column.delete({where:{id:duplicate.id}});}
  const before=await db.cell.findFirst({where:{rowId:old.rowId,columnId:reasonColumn}});
  await db.cell.updateMany({where:{rowId:old.rowId,columnId:reasonColumn},data:{value:'z'.repeat(66000)}});
  try{expect((await get('/agent/project/research/records/'+old.rowId+'?kind=website')).statusCode).toBe(409);const page=await get('/agent/project/research/index?kind=website&q=old-needle');expect(page.statusCode).toBe(200);expect(page.json().items[0].excerpt).toHaveLength(240);}
  finally{await db.cell.updateMany({where:{rowId:old.rowId,columnId:reasonColumn},data:{value:before!.value!}});}
 });
 it('removed rows are not recreated by reads; revoked credentials fail and no outbound work is created',async()=>{
  const saved=await service.saveAnalysis(ws,'delete-archive.invalid','Docker','pasted_text',randomUUID(),a);await db.row.delete({where:{id:saved.rowId}});
  expect((await get('/agent/project/research/records/'+saved.rowId+'?kind=website')).statusCode).toBe(404);expect((await get('/agent/project/research/index?kind=website&q=delete-archive')).json().items).toEqual([]);
  expect(await db.outboundJob.count({where:{workspaceId:ws}})).toBe(0);await tokens.revoke(ws,reader.id);expect((await get('/agent/project/research/index?kind=website')).statusCode).toBe(401);
 });
});
