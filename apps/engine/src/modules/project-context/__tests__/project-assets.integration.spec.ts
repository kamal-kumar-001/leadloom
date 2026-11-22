import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {ProjectAssetService,AssetConflict} from '../project-asset.service';
import {ProjectRegistryService,PrismaProjectRegistryStore} from '../project-registry.service';
import {AgentTokenService,InMemoryAgentTokenStore} from '../../auth/agent-token.service';
import {createApplication} from '../../../main';
import {issueSession} from '../../auth/issuer';
import {CreateProjectAssetSchema,ReviseProjectAssetSchema} from '@leadloom/contracts';
it('bounds private text asset requests and rejects executable/audience/approval fields',()=>{
 const input={requestId:randomUUID(),kind:'investor_pitch',title:'Pitch',body:'Plain text'};
 expect(CreateProjectAssetSchema.safeParse(input).success).toBe(true);for(const field of ['published','recipients','html','projectId'])expect(CreateProjectAssetSchema.safeParse({...input,[field]:'extra'}).success).toBe(false);
 expect(CreateProjectAssetSchema.safeParse({...input,body:'x'.repeat(40001)}).success).toBe(false);expect(ReviseProjectAssetSchema.safeParse({requestId:input.requestId,title:'Pitch',body:'New',expectedVersion:0}).success).toBe(false);
});
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native project drafts preserve version history, scoped retrieval, safe retries/concurrent CAS and atomic rollback with no sends',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),a=randomUUID(),b=randomUUID(),foreign=randomUUID(),uid=randomUUID(),key=Buffer.alloc(32,9),tag='asset_failure_'+randomUUID().replaceAll('-','');let app:any;
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Synthetic project drafts'},{id:other,name:'Foreign drafts'}]});await db.user.create({data:{id:uid,workspaceId:ws,email:uid+'@example.invalid',name:'Synthetic asset author'}});
  for(const [id,w,name]of [[a,ws,'Alpha'],[b,ws,'Beta'],[foreign,other,'Foreign']])await db.$executeRawUnsafe('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,$3,$3)',id,w,name.toLowerCase());
  const service=new ProjectAssetService(db),input={requestId:randomUUID(),kind:'investor_pitch' as const,title:'Seed pitch',body:'Caller-written draft. '+('Detailed private source notes. '.repeat(400))};
  const results=await Promise.all(Array.from({length:8},()=>service.create(ws,a,uid,input)));expect(new Set(results.map(r=>r!.id)).size).toBe(1);expect(results.filter(r=>!r!.replayed)).toHaveLength(1);const asset=results[0]!;
  expect(await new ProjectAssetService(db).get(ws,a,asset.id)).toMatchObject({body:input.body,version:1});expect(await service.get(ws,b,asset.id)).toBeNull();expect(await service.get(other,foreign,asset.id)).toBeNull();
  await expect(service.create(ws,a,uid,{...input,title:'Different retry'})).rejects.toBeInstanceOf(AssetConflict);
  const changes=await Promise.allSettled(['One','Two'].map(title=>service.revise(ws,a,uid,asset.id,{requestId:randomUUID(),expectedVersion:1,title,body:'New version '+title})));expect(changes.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(changes.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect((await service.get(ws,a,asset.id,1))?.body).toBe(input.body);const current=(await service.get(ws,a,asset.id))!;expect(current.version).toBe(2);
  const reviseInput={requestId:randomUUID(),expectedVersion:2,title:'Third version',body:'Retained exact third version'};const third=await service.revise(ws,a,uid,asset.id,reviseInput);expect(third?.version).toBe(3);expect((await service.revise(ws,a,uid,asset.id,reviseInput))?.replayed).toBe(true);expect(await service.create(ws,a,uid,input)).toMatchObject({version:1,currentVersion:3,replayed:true});
  await expect(service.revise(ws,a,uid,asset.id,{...reviseInput,body:'Changed retry'})).rejects.toBeInstanceOf(AssetConflict);
  const list=await service.list(ws,a,{q:'Retained',limit:1,offset:0});expect(list.items[0].id).toBe(asset.id);expect(list.items[0]).not.toHaveProperty('body');expect(list.items[0].excerpt.length).toBeLessThanOrEqual(240);expect((await service.list(ws,a,{q:'Detailed private',limit:20,offset:0})).items).toEqual([]);expect((await service.get(ws,a,asset.id,1))?.body.length).toBeGreaterThan(6000);
  await service.create(ws,a,uid,{...input,requestId:randomUUID(),title:'Second asset'});expect((await service.list(ws,a,{limit:1,offset:0})).nextOffset).toBe(1);expect((await service.list(ws,a,{limit:1,offset:1})).items).toHaveLength(1);
  const store=new InMemoryAgentTokenStore(),tokens=new AgentTokenService(store);store.users.set(uid,{role:'member',disabledAt:null});store.workspaces.set(ws,{active:true});
  const rw=await tokens.issue(ws,uid,{name:'Alpha drafts',projectId:a,scopes:['project:assets:read','project:assets:write']}),read=await tokens.issue(ws,uid,{name:'Alpha draft reader',projectId:a,scopes:['project:assets:read']}),context=await tokens.issue(ws,uid,{name:'Context only',projectId:a,scopes:['context:read','context:write']}),unbound=await tokens.issue(ws,uid,{name:'Unbound',scopes:['project:assets:read']});
  app=await createApplication({sessionKey:key,prisma:db,projectAssets:service,projectRegistry:new ProjectRegistryService(new PrismaProjectRegistryStore(db)),agentTokens:tokens} as any);const server=app.getHttpAdapter().getInstance(),call=(method:any,path:string,payload?:any,token=rw.token)=>server.inject({method,url:path,payload,headers:{authorization:'Bearer '+token}});
  expect((await call('GET','/agent/project/assets/'+asset.id+'?version=1')).json().body).toBe(input.body);expect((await call('GET','/agent/project/assets?projectId='+b)).statusCode).toBe(400);
  for(const token of [context.token,unbound.token])expect((await call('GET','/agent/project/assets',undefined,token)).statusCode).toBe(403);
  expect((await call('POST','/agent/project/assets',input,read.token)).statusCode).toBe(403);expect((await call('GET','/projects/'+a+'/assets',undefined,rw.token)).statusCode).toBe(403);
  const human=issueSession({workspaceId:ws,userId:uid,role:'member'},key,3600).token,readonly=issueSession({workspaceId:ws,userId:uid,role:'read_only'},key,3600).token;
  expect((await call('GET','/projects/'+b+'/assets/'+asset.id,undefined,human)).statusCode).toBe(404);expect((await call('GET','/projects/'+foreign+'/assets',undefined,human)).statusCode).toBe(404);expect((await call('POST','/projects/'+a+'/assets',input,readonly)).statusCode).toBe(403);
  expect((await call('POST','/agent-tokens',{name:'Missing binding',scopes:['project:assets:write']},human)).statusCode).toBe(400);
  // A failure inserting a new version must not advance the asset head or leave a new asset.
  await db.$executeRawUnsafe(`CREATE FUNCTION ${tag}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.workspace_id='${ws}'::uuid THEN RAISE EXCEPTION 'Synthetic private asset diagnostic'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER ${tag} BEFORE INSERT ON project_asset_versions FOR EACH ROW EXECUTE FUNCTION ${tag}()`);
  const before=(await db.$queryRawUnsafe<any[]>('SELECT * FROM project_assets WHERE id=$1::uuid',asset.id))[0];const failed=await call('PUT','/agent/project/assets/'+asset.id,{requestId:randomUUID(),expectedVersion:3,title:'Failure',body:'Not stored'});expect(failed.statusCode).toBe(503);expect(failed.body).not.toContain('diagnostic');expect((await db.$queryRawUnsafe<any[]>('SELECT * FROM project_assets WHERE id=$1::uuid',asset.id))[0]).toEqual(before);
  expect((await call('POST','/agent/project/assets',{...input,requestId:randomUUID()})).statusCode).toBe(503);expect((await db.$queryRawUnsafe<any[]>('SELECT count(*)::int AS n FROM project_assets WHERE project_id=$1::uuid',a))[0].n).toBe(2);
  expect(await db.outboundJob.count({where:{workspaceId:ws}})).toBe(0);await tokens.revoke(ws,rw.id);expect((await call('GET','/agent/project/assets')).statusCode).toBe(401);
 }finally{await app?.close();await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${tag} ON project_asset_versions`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${tag}()`);await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});expect((await db.$queryRawUnsafe<any[]>('SELECT count(*)::int AS n FROM project_asset_versions WHERE workspace_id=$1::uuid',ws))[0].n).toBe(0);await db.$disconnect();}
},30000);
