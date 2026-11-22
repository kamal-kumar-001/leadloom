import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {createApplication} from '../../../main';
import {ProjectRegistryService,PrismaProjectRegistryStore} from '../../project-context/project-registry.service';
import {AgentTokenService,PrismaAgentTokenStore} from '../../auth/agent-token.service';
import {ProjectExperimentDraftService} from '../project-experiment-draft.service';
import {ProjectExperimentResultsService} from '../project-experiment-results.service';
import {issueSession} from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native project aggregate results restore exact stored provenance, partition and no contact/action/visitor side effects',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),p=randomUUID(),q=randomUUID(),foreign=randomUUID(),uid=randomUUID(),key=Buffer.alloc(32,7);let app:any;
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Private results fixture'},{id:other,name:'Foreign results fixture'}]});await db.user.create({data:{id:uid,workspaceId:ws,email:uid+'@example.invalid',role:'read_only'}});
  for(const [id,w]of [[p,ws],[q,ws],[foreign,other]])await db.$executeRawUnsafe('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,$3,$3)',id,w,id);
  await db.user.update({where:{id:uid},data:{role:'admin'}});const draftService=new ProjectExperimentDraftService(db),create=async(projectId:string)=>{const result=await draftService.create(ws,projectId,uid,{requestId:randomUUID(),rawHypothesis:'Synthetic exact results hypothesis',preferredSlug:'results-'+randomUUID(),pageCopy:{title:'Synthetic private',headline:'Exact synthetic headline',subheadline:'No external publication',heroCtaText:'Join'},surveyQuestions:[]});return result!;};const alpha=await create(p),beta=await create(q);
  const unassigned=await db.validationExperiment.create({data:{workspaceId:ws,hypothesis:'Unassigned results'}});await db.user.update({where:{id:uid},data:{role:'read_only'}});
  const page=(await db.smokeTestPage.findFirst({where:{experimentId:alpha.experimentId}}))!;await db.smokeTestPage.update({where:{id:page.id},data:{visitors:2}});await db.validationExperiment.update({where:{id:alpha.experimentId},data:{outreachSent:7,replies:3,positiveReplies:1,actionableSummary:'Private conclusion must not be disclosed'}});
  for(let n=0;n<3;n++)await db.waitlistLead.create({data:{pageId:page.id,email:'private-contact-'+n+'@example.invalid',name:'Private person',company:'Private company',surveyResponses:{private_answer:'Do not return me'}}});
  const tokens=new AgentTokenService(new PrismaAgentTokenStore(db)),observer=await tokens.issue(ws,uid,{name:'Results only',projectId:p,scopes:['project:experiments:results']}),pageReader=await tokens.issue(ws,uid,{name:'Page only',projectId:p,scopes:['project:experiments:read']}),unbound=await tokens.issue(ws,uid,{name:'Unbound results',scopes:['project:experiments:results']}),wrong=await tokens.issue(ws,uid,{name:'Foreign project',projectId:foreign,scopes:['project:experiments:results']});
  app=await createApplication({sessionKey:key,prisma:db,agentTokens:tokens,projectRegistry:new ProjectRegistryService(new PrismaProjectRegistryStore(db))}as any);const server=app.getHttpAdapter().getInstance(),get=(id=alpha.experimentId,t=observer.token,suffix='')=>server.inject({method:'GET',url:'/agent/project/experiments/'+id+'/results'+suffix,headers:{authorization:'Bearer '+t}});
  const response=await get(),result=response.json();expect(response.statusCode).toBe(200);expect(response.headers['cache-control']).toBe('no-store');expect(result.counts).toEqual({pages:1,pageLoads:2,storedSubmissions:3,recordedOutreachSent:7,recordedReplies:3,recordedPositiveReplies:1});expect(result.ratios).toEqual({storedSubmissionsPerPageLoad:1.5,recordedRepliesPerOutreach:3/7,recordedPositiveRepliesPerOutreach:1/7});expect(result.pages).toEqual([{slug:page.slug,status:'draft',pageLoads:2,storedSubmissions:3}]);expect(result.provenance.outreach).toContain('Owner-recorded');expect(result.verdict).toBeUndefined();expect(result.confidence).toBeUndefined();
  const human=issueSession({workspaceId:ws,userId:uid,role:'read_only'},key,3600).token;
  const humanGet=(projectId=p,id=alpha.experimentId,token=human,suffix='')=>server.inject({method:'GET',url:'/projects/'+projectId+'/experiments/'+id+'/results'+suffix,headers:{authorization:'Bearer '+token}});
  const humanResult=await humanGet();expect(humanResult.statusCode).toBe(200);expect(humanResult.json().counts).toEqual(result.counts);expect(humanResult.headers['cache-control']).toBe('no-store');
  for(const id of[q,foreign,randomUUID()])expect((await humanGet(id)).statusCode).toBe(404);
  for(const id of[beta.experimentId,unassigned.id,randomUUID()])expect((await humanGet(p,id)).statusCode).toBe(404);
  const workspaceReader=await tokens.issue(ws,uid,{name:'Workspace experiments reader',scopes:['experiments:read']});
  for(const token of[observer.token,workspaceReader.token])expect((await humanGet(p,alpha.experimentId,token)).statusCode).toBe(403);
  expect((await humanGet(p,alpha.experimentId,human,'?include=leads')).statusCode).toBe(400);
  for(const value of ['private-contact','Private person','Private company','private_answer','Do not return me','Private conclusion','hypothesis'])expect(response.body).not.toContain(value);
  for(const id of [beta.experimentId,unassigned.id,randomUUID()])expect((await get(id)).statusCode).toBe(404);expect((await get(alpha.experimentId,wrong.token)).statusCode).toBe(404);
  for(const token of [pageReader.token,unbound.token,issueSession({workspaceId:ws,userId:uid,role:'read_only'},key,3600).token])expect((await get(alpha.experimentId,token)).statusCode).toBe(403);
  for(const query of ['?projectId='+q,'?include=leads','?email=private@example.invalid'])expect((await get(alpha.experimentId,observer.token,query)).statusCode).toBe(400);
  for(const [method,url,body]of [['GET','/agent/project/experiments/'+alpha.experimentId+'/page',undefined],['POST','/validator/experiments/'+alpha.experimentId+'/publish',{}],['POST','/validator/experiments/'+alpha.experimentId+'/outreach',{outreachSent:8,replies:4,positiveReplies:1}],['GET','/validator/experiments/'+alpha.experimentId+'/leads',undefined]]as const)expect([403,404]).toContain((await server.inject({method,url,headers:{authorization:'Bearer '+observer.token},payload:body})).statusCode);
  expect((await db.smokeTestPage.findUnique({where:{id:page.id}}))!.visitors).toBe(2);expect(await db.outboundJob.count({where:{workspaceId:ws}})).toBe(0);expect(await db.campaign.count({where:{workspaceId:ws}})).toBe(0);
  const empty=(await get(beta.experimentId,(await tokens.issue(ws,uid,{name:'Beta results',projectId:q,scopes:['project:experiments:results']})).token)).json();expect(empty.counts.pageLoads).toBe(0);expect(Object.values(empty.ratios)).toEqual([null,null,null]);
  const service=new ProjectExperimentResultsService(db);await db.$executeRawUnsafe('UPDATE validation_experiments SET replies=8 WHERE id=$1::uuid',alpha.experimentId);expect((await get()).statusCode).toBe(503);expect((await humanGet()).statusCode).toBe(503);await db.$executeRawUnsafe('UPDATE validation_experiments SET replies=3 WHERE id=$1::uuid',alpha.experimentId);
  const original=db.$transaction.bind(db);(db as any).$transaction=async()=>{throw Error('Synthetic private storage diagnostics');};const unavailable=await get();expect(unavailable.statusCode).toBe(503);expect(unavailable.body).not.toContain('diagnostics');(db as any).$transaction=original;
  await db.waitlistLead.deleteMany({where:{pageId:page.id}});expect((await service.read(ws,p,alpha.experimentId))!.counts.storedSubmissions).toBe(0);expect((await service.read(ws,p,alpha.experimentId))!.counts.pageLoads).toBe(2);
  const bounded=await db.validationExperiment.create({data:{workspaceId:ws,projectId:p,hypothesis:'Many page bound'}});for(let n=0;n<101;n++)await db.smokeTestPage.create({data:{experimentId:bounded.id,slug:'bounded-'+bounded.id+'-'+n,title:'Bounded',headline:'Bounded',subheadline:'Bounded'}});expect((await get(bounded.id)).statusCode).toBe(503);expect((await humanGet(p,bounded.id)).statusCode).toBe(503);await db.validationExperiment.delete({where:{id:bounded.id}});
  await tokens.revoke(ws,observer.id);expect((await get()).statusCode).toBe(401);await db.user.update({where:{id:uid},data:{role:'admin'}});expect((await server.inject({method:'POST',url:'/agent-tokens',headers:{authorization:'Bearer '+issueSession({workspaceId:ws,userId:uid,role:'admin'},key,3600).token},payload:{name:'No results binding',scopes:['project:experiments:results']}})).statusCode).toBe(400);
 }finally{await app?.close();await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});await db.$disconnect();}
},30000);
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native aggregate composition rolls back or commits with its local historical record in one transaction',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),project=randomUUID(),request=randomUUID();
 try{
  await db.workspace.create({data:{id:ws,name:'Atomic private aggregate fixture'}});await db.$executeRawUnsafe('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,$3,$3)',project,ws,project);
  const experiment=await db.validationExperiment.create({data:{workspaceId:ws,projectId:project,hypothesis:'Atomic recorded counters'}}),service=new ProjectExperimentResultsService(db);
  const record=async(tx:any)=>{const result=await service.readInTransaction(tx,ws,project,experiment.id);expect(result?.counts.recordedOutreachSent).toBe(0);await tx.$queryRawUnsafe('INSERT INTO project_entries(workspace_id,project_id,request_id,kind,title,body)VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6) RETURNING id',ws,project,request,'research','Atomic aggregate fixture',JSON.stringify(result));return result;};
  await expect(db.$transaction(async tx=>{await record(tx);throw Error('Synthetic rollback after observation');},{isolationLevel:'RepeatableRead'})).rejects.toThrow('Synthetic rollback');
  expect((await db.$queryRawUnsafe<any[]>('SELECT id FROM project_entries WHERE workspace_id=$1::uuid',ws))).toHaveLength(0);
  const snapshot=await db.$transaction(record,{isolationLevel:'RepeatableRead'});const saved=(await db.$queryRawUnsafe<any[]>('SELECT body FROM project_entries WHERE workspace_id=$1::uuid',ws))[0];expect(JSON.parse(saved.body)).toEqual(snapshot);
  await db.validationExperiment.update({where:{id:experiment.id},data:{outreachSent:5}});expect((await service.read(ws,project,experiment.id))?.counts.recordedOutreachSent).toBe(5);expect(JSON.parse(saved.body).counts.recordedOutreachSent).toBe(0);
 }finally{await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
},30000);
