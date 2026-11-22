import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@leadloom/database';
import { createApplication } from '../../../main';
import { ValidatorService } from '../../validator/validator.service';
import { ValidatorController } from '../../validator/validator.controller';
import { WorkspaceReadService } from '../../workspace-read/workspace-read.service';
import { ProjectRegistryService,PrismaProjectRegistryStore } from '../project-registry.service';
import { AgentTokenService,InMemoryAgentTokenStore } from '../../auth/agent-token.service';
import { issueSession } from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native project-owned experiments fence Alpha/Beta/unassigned/foreign reads and enforce tenant FK at creation',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),a=randomUUID(),b=randomUUID(),foreign=randomUUID(),uid=randomUUID(),key=Buffer.alloc(32,6);let app:any;
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Synthetic project experiments'},{id:other,name:'Foreign project workspace'}]});
  for(const [id,w,name]of [[a,ws,'Alpha'],[b,ws,'Beta'],[foreign,other,'Foreign']])await db.$executeRawUnsafe('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,$3,$3)',id,w,name.toLowerCase());
  const service=new ValidatorService('http://localhost:3000',db),controller=new ValidatorController(service),reads=new WorkspaceReadService(db as any),registry=new ProjectRegistryService(new PrismaProjectRegistryStore(db));
  const create=(projectId?:string)=>controller.generate(ws,{rawHypothesis:'Synthetic project partition test '+randomUUID(),...(projectId?{projectId}:{})});
  const alpha=await create(a),beta=await create(b),unassigned=await create();
  expect((await reads.listExperiments(ws,a)).map(r=>r.id)).toEqual([alpha.experimentId]);expect((await reads.listExperiments(ws,b)).map(r=>r.id)).toEqual([beta.experimentId]);expect((await reads.listExperiments(ws,null)).map(r=>r.id)).toEqual([unassigned.experimentId]);
  await expect(create(foreign)).rejects.toThrow();await expect(create(randomUUID())).rejects.toThrow();expect(await db.validationExperiment.count({where:{workspaceId:ws}})).toBe(3);
  const store=new InMemoryAgentTokenStore(),tokens=new AgentTokenService(store);store.users.set(uid,{role:'read_only',disabledAt:null});store.workspaces.set(ws,{active:true});
  const scoped=await tokens.issue(ws,uid,{name:'Alpha experiment observer',projectId:a,scopes:['project:experiments:read']}),context=await tokens.issue(ws,uid,{name:'Context only',projectId:a,scopes:['context:read']}),unbound=await tokens.issue(ws,uid,{name:'Unbound project scope',scopes:['project:experiments:read']}),workspace=await tokens.issue(ws,uid,{name:'Workspace observer',scopes:['experiments:read']});
  app=await createApplication({sessionKey:key,prisma:db,reads,projectRegistry:registry,validator:controller,agentTokens:tokens} as any);const server=app.getHttpAdapter().getInstance();const get=(path:string,token=scoped.token)=>server.inject({method:'GET',url:path,headers:{authorization:'Bearer '+token}});
  expect((await get('/agent/project/experiments')).json().map((r:any)=>r.id)).toEqual([alpha.experimentId]);expect((await get('/agent/project/experiments/'+alpha.experimentId+'/page')).statusCode).toBe(200);
  for(const id of [beta.experimentId,unassigned.experimentId,randomUUID()])expect((await get('/agent/project/experiments/'+id+'/page')).statusCode).toBe(404);
  expect((await get('/agent/project/experiments?projectId='+b)).statusCode).toBe(400);
  for(const token of [context.token,unbound.token,workspace.token])expect((await get('/agent/project/experiments',token)).statusCode).toBe(403);
  expect((await get('/workspace/experiments',scoped.token)).statusCode).toBe(403);
  expect((await get('/validator/experiments/'+beta.experimentId+'/page',scoped.token)).statusCode).toBe(403);
  expect((await get('/workspace/experiments?projectId='+a,workspace.token)).json().map((r:any)=>r.id)).toEqual([alpha.experimentId]);expect((await get('/workspace/experiments?projectId='+foreign,workspace.token)).statusCode).toBe(404);
  const human=issueSession({workspaceId:ws,userId:uid,role:'member'},key,3600).token;expect((await server.inject({method:'POST',url:'/agent-tokens',headers:{authorization:'Bearer '+human},payload:{name:'Invalid unbound observation',scopes:['project:experiments:read']}})).statusCode).toBe(400);expect((await get('/workspace/experiments?projectId=unassigned',human)).json().map((r:any)=>r.id)).toEqual([unassigned.experimentId]);
  await tokens.revoke(ws,scoped.id);expect((await get('/agent/project/experiments')).statusCode).toBe(401);
 }finally{await app?.close();await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});await db.$disconnect();}
});
