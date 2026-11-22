import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {createApplication} from '../../../main';
import {CampaignRecipientsRepository} from '../campaign-recipients.repository';
import {PrismaDispatchDatabase} from '../prisma-database';
import {WorkspaceReadService} from '../../workspace-read/workspace-read.service';
import {ProjectRegistryService,PrismaProjectRegistryStore} from '../../project-context/project-registry.service';
import {AgentTokenService,InMemoryAgentTokenStore} from '../../auth/agent-token.service';
import {issueSession} from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native project campaign ownership, observer boundaries, tenant FK and atomic draft/pool rollback',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),alpha=randomUUID(),beta=randomUUID(),foreign=randomUUID(),uid=randomUUID(),mailbox=randomUUID(),secondMailbox=randomUUID(),key=Buffer.alloc(32,8);let app:any;
 const trigger='campaign_rollback_'+randomUUID().replaceAll('-','');
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Campaign project fixture'},{id:other,name:'Foreign campaign fixture'}]});
  for(const [id,w,name]of [[alpha,ws,'Alpha'],[beta,ws,'Beta'],[foreign,other,'Foreign']])await db.$executeRawUnsafe('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,$3,$3)',id,w,name.toLowerCase());
  for(const id of [mailbox,secondMailbox])await db.$executeRawUnsafe("INSERT INTO mailboxes(id,workspace_id,email,smtp_host,updated_at)VALUES($1::uuid,$2::uuid,$3,'smtp.example.invalid',now())",id,ws,id+'@example.invalid');
  const recipients=new CampaignRecipientsRepository(new PrismaDispatchDatabase(db)),reads=new WorkspaceReadService(db),registry=new ProjectRegistryService(new PrismaProjectRegistryStore(db));
  const input={name:'Native draft',steps:[{stepNumber:1,delayHours:0,subject:'Synthetic',bodyTemplate:'No sends'}],dailyLimitTotal:5,scheduleTimezone:'UTC',mailboxPoolIds:[mailbox,mailbox]};
  const a=(await recipients.createCampaign(ws,{...input,projectId:alpha}))!,b=(await recipients.createCampaign(ws,{...input,projectId:beta}))!,unassigned=(await recipients.createCampaign(ws,input))!;
  expect(a.projectId).toBe(alpha);expect(unassigned.projectId).toBeNull();expect(await db.$queryRawUnsafe('SELECT mailbox_id FROM campaign_mailboxes WHERE campaign_id=$1::uuid',a.id)).toHaveLength(1);
  for(const projectId of [foreign,randomUUID()])expect(await recipients.createCampaign(ws,{...input,projectId})).toBeNull();
  await expect(db.$executeRawUnsafe('UPDATE campaigns SET project_id=$1::uuid WHERE id=$2::uuid',foreign,a.id)).rejects.toThrow();
  expect((await reads.listCampaigns(ws,alpha)).map(c=>c.id)).toEqual([a.id]);expect((await reads.listCampaigns(ws,null)).map(c=>c.id)).toEqual([unassigned.id]);
  const job=randomUUID();await db.$executeRawUnsafe("INSERT INTO outbound_jobs(id,workspace_id,campaign_id,recipient_email,recipient_hash,idempotency_key,step_number,status,scheduled_at,updated_at)VALUES($1::uuid,$2::uuid,$3::uuid,'observer@example.invalid',$4,$5,1,'pending_approval',now(),now())",job,ws,a.id,'a'.repeat(64),randomUUID());
  const store=new InMemoryAgentTokenStore(),tokens=new AgentTokenService(store);store.users.set(uid,{role:'member',disabledAt:null});store.workspaces.set(ws,{active:true});
  const scoped=await tokens.issue(ws,uid,{name:'Alpha observer',projectId:alpha,scopes:['project:campaigns:read']}),context=await tokens.issue(ws,uid,{name:'Alpha context',projectId:alpha,scopes:['context:read']}),unbound=await tokens.issue(ws,uid,{name:'Unbound',scopes:['project:campaigns:read']}),workspace=await tokens.issue(ws,uid,{name:'Workspace',scopes:['campaigns:read']}),boundWildcard=await tokens.issue(ws,uid,{name:'Wildcard project',projectId:alpha,scopes:['*']});
  app=await createApplication({sessionKey:key,prisma:db,reads,projectRegistry:registry,agentTokens:tokens,recipients,credentials:{save:async()=>({}),list:async()=>[],delete:async()=>false},outbound:{enqueue:async()=>randomUUID()}} as any);
  const server=app.getHttpAdapter().getInstance(),get=(path:string,token=scoped.token)=>server.inject({method:'GET',url:path,headers:{authorization:'Bearer '+token}});
  expect((await get('/agent/project/campaigns')).json().map((c:any)=>c.id)).toEqual([a.id]);
  const jobs=(await get('/agent/project/campaigns/'+a.id+'/jobs')).json();expect(jobs.campaign.projectId).toBe(alpha);expect(jobs.jobs[0].id).toBe(job);expect(jobs.jobs[0].recipientEmail).toBe('observer@example.invalid');expect(jobs.jobs[0].providerMessageId).toBeUndefined();
  for(const id of [b.id,unassigned.id,randomUUID()])expect((await get('/agent/project/campaigns/'+id+'/jobs')).statusCode).toBe(404);
  for(const token of [context.token,unbound.token,workspace.token])expect((await get('/agent/project/campaigns',token)).statusCode).toBe(403);
  expect((await get('/agent/project/campaigns?projectId='+beta)).statusCode).toBe(400);expect((await get('/workspace/campaigns',scoped.token)).statusCode).toBe(403);expect((await get('/workspace/campaigns',boundWildcard.token)).statusCode).toBe(403);
  expect((await get('/workspace/campaigns?projectId='+alpha,workspace.token)).json().map((c:any)=>c.id)).toEqual([a.id]);expect((await get('/workspace/campaigns?projectId='+foreign,workspace.token)).statusCode).toBe(404);expect((await get('/workspace/campaigns?other=bad',workspace.token)).statusCode).toBe(400);
  const human=issueSession({workspaceId:ws,userId:uid,role:'member'},key,3600).token;
  expect((await get('/workspace/campaigns?projectId=unassigned',human)).json().map((c:any)=>c.id)).toEqual([unassigned.id]);
  expect((await server.inject({method:'POST',url:'/agent-tokens',headers:{authorization:'Bearer '+human},payload:{name:'Unbound',scopes:['project:campaigns:read']}})).statusCode).toBe(400);
  expect((await server.inject({method:'POST',url:'/workspace/campaigns',headers:{authorization:'Bearer '+scoped.token},payload:{...input,projectId:alpha}})).statusCode).toBe(403);
  const before=await db.campaign.count({where:{workspaceId:ws}});
  // Trigger fails on the second pool write after campaign and first pool write.
  await db.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.mailbox_id='${secondMailbox}'::uuid THEN RAISE EXCEPTION 'Synthetic private storage diagnostic'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON campaign_mailboxes FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
  const failed=await server.inject({method:'POST',url:'/workspace/campaigns',headers:{authorization:'Bearer '+human},payload:{...input,projectId:alpha,mailboxPoolIds:[mailbox,secondMailbox]}});
  expect(failed.statusCode).toBe(503);expect(failed.body).not.toContain('private');expect(await db.campaign.count({where:{workspaceId:ws}})).toBe(before);
  expect((await db.$queryRawUnsafe<any[]>('SELECT count(*)::int AS n FROM campaign_mailboxes WHERE workspace_id=$1::uuid',ws))[0].n).toBe(3);
  await tokens.revoke(ws,scoped.id);expect((await get('/agent/project/campaigns')).statusCode).toBe(401);
  expect((await db.outboundJob.findUnique({where:{id:job}}))?.status).toBe('pending_approval');
 }finally{
  await app?.close();await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON campaign_mailboxes`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});await db.$disconnect();
 }
},30000);
