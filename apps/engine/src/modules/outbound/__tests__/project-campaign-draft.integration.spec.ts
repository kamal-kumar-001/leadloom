import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {CampaignRecipientsRepository} from '../campaign-recipients.repository';
import {PrismaDispatchDatabase} from '../prisma-database';
import {AgentTokenService,InMemoryAgentTokenStore} from '../../auth/agent-token.service';
import {ProjectRegistryService,PrismaProjectRegistryStore} from '../../project-context/project-registry.service';
import {createApplication} from '../../../main';
import {issueSession} from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native explicit project campaign draft creation persists caller copy with receipts and never grants dispatch or state reset',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),p=randomUUID(),q=randomUUID(),uid=randomUUID(),key=Buffer.alloc(32,7);let app:any;
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Customer draft fixture'},{id:other,name:'Other draft fixture'}]});await db.user.create({data:{id:uid,workspaceId:ws,email:uid+'@example.invalid',role:'admin'}});for(const id of [p,q])await db.$executeRawUnsafe('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,$3,$3)',id,ws,id);
  const repo=new CampaignRecipientsRepository(new PrismaDispatchDatabase(db)),store=new InMemoryAgentTokenStore(),tokens=new AgentTokenService(store);store.users.set(uid,{role:'admin',disabledAt:null});store.workspaces.set(ws,{active:true});const writer=await tokens.issue(ws,uid,{name:'Private drafts',projectId:p,scopes:['project:campaigns:draft']}),reader=await tokens.issue(ws,uid,{name:'Only read',projectId:p,scopes:['project:campaigns:read']}),unbound=await tokens.issue(ws,uid,{name:'Unbound draft',scopes:['project:campaigns:draft']}),otherWriter=await tokens.issue(other,uid,{name:'Foreign binding',projectId:p,scopes:['project:campaigns:draft']});
  app=await createApplication({sessionKey:key,recipients:repo,projectRegistry:new ProjectRegistryService(new PrismaProjectRegistryStore(db)),agentTokens:tokens} as any);const server=app.getHttpAdapter().getInstance(),payload={requestId:randomUUID(),name:'Exact customer-authored campaign',steps:[{stepNumber:1,delayHours:0,subject:'Literal {{firstName}} subject',bodyTemplate:'Exact caller text <script>not executed</script>'}]},post=(body:any=payload,t=writer.token,suffix='')=>server.inject({method:'POST',url:'/agent/project/campaign-drafts'+suffix,headers:{authorization:'Bearer '+t},payload:body});
  const parallel=await Promise.all(Array.from({length:8},()=>post()));expect(parallel.filter(r=>r.statusCode===201)).toHaveLength(1);expect(parallel.filter(r=>r.statusCode===200)).toHaveLength(7);const saved=parallel[0].json();expect(saved.projectId).toBe(p);expect(saved.status).toBe('draft');expect(saved.steps).toEqual(payload.steps);expect(await db.campaign.count({where:{workspaceId:ws}})).toBe(1);
  expect(await db.$queryRawUnsafe('SELECT * FROM campaign_mailboxes WHERE campaign_id=$1::uuid',saved.id)).toEqual([]);expect(await db.$queryRawUnsafe('SELECT * FROM campaign_recipients WHERE campaign_id=$1::uuid',saved.id)).toEqual([]);expect(await db.outboundJob.count({where:{workspaceId:ws}})).toBe(0);expect((await db.campaign.findUnique({where:{id:saved.id}}))!.tableId).toBeNull();
  expect((await post({...payload,name:'Different input'})).statusCode).toBe(409);for(const extra of [{projectId:q},{mailboxPoolIds:[]},{recipients:[]},{status:'active'},{steps:[{...payload.steps[0],approval:true}]}])expect((await post({...payload,...extra})).statusCode).toBe(400);
  expect((await post(payload,writer.token,'?projectId='+q)).statusCode).toBe(400);
  for(const t of [reader.token,unbound.token,issueSession({workspaceId:ws,userId:uid,role:'admin'},key,3600).token])expect((await post(payload,t)).statusCode).toBe(403);expect((await post(payload,otherWriter.token)).statusCode).toBe(404);
  await db.campaign.update({where:{id:saved.id},data:{status:'active',name:'Human changed name'}});const retry=(await post()).json();expect(retry.status).toBe('active');expect(retry.name).toBe('Human changed name');expect(retry.replayed).toBe(true);expect(await db.outboundJob.count({where:{workspaceId:ws}})).toBe(0);
  // Read/write lifecycle and recipient routes remain unannotated, not covered by the draft scope.
  for(const [method,path,body]of [['POST','/workspace/campaigns',payload],['PUT','/campaigns/'+saved.id+'/status',{status:'active'}],['POST','/campaigns/'+saved.id+'/recipients',{recipients:[{email:'synthetic@example.invalid'}]}],['POST','/outbound/release',{}]] as const){const r=await server.inject({method,url:path,headers:{authorization:'Bearer '+writer.token},payload:body});expect([403,404]).toContain(r.statusCode);}
  store.users.set(uid,{role:'read_only',disabledAt:null});expect((await post()).statusCode).toBe(403);store.users.set(uid,{role:'admin',disabledAt:null});
  const original=repo.createCampaign.bind(repo);repo.createCampaign=async()=>{throw Error('private campaign SQL diagnostics');};const failure=await post({...payload,requestId:randomUUID()});expect(failure.statusCode).toBe(503);expect(failure.body).not.toContain('diagnostics');repo.createCampaign=original;
  await db.campaign.delete({where:{id:saved.id}});expect((await post()).statusCode).toBe(409);await tokens.revoke(ws,writer.id);expect((await post()).statusCode).toBe(401);
  expect((await server.inject({method:'POST',url:'/agent-tokens',headers:{authorization:'Bearer '+issueSession({workspaceId:ws,userId:uid,role:'admin'},key,3600).token},payload:{name:'No bound project',scopes:['project:campaigns:draft']}})).statusCode).toBe(400);
 }finally{await app?.close();await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});await db.$disconnect();}
},30000);
