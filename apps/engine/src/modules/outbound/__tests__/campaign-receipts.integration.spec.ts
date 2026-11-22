import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {CampaignRecipientsRepository,CampaignCreateConflict} from '../campaign-recipients.repository';
import {PrismaDispatchDatabase} from '../prisma-database';
import {createApplication} from '../../../main';
import {issueSession} from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native campaign request receipts serialize retries, retain current state, isolate tenants, roll back receipt failure and retain deletion tombstones',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),mailbox=randomUUID(),project=randomUUID(),key=Buffer.alloc(32,4),tag='campaign_receipt_failure_'+randomUUID().replaceAll('-','');let app:any;
 const input={requestId:randomUUID(),name:'Receipt draft',projectId:project,steps:[{stepNumber:1,delayHours:0,subject:'Synthetic',bodyTemplate:'No sends'}],dailyLimitTotal:12,scheduleTimezone:'UTC',mailboxPoolIds:[mailbox,mailbox]};
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Campaign request receipts'},{id:other,name:'Other receipts'}]});await db.$executeRawUnsafe("INSERT INTO projects(id,workspace_id,slug,name)VALUES($1::uuid,$2::uuid,'receipts','Receipts')",project,ws);await db.$executeRawUnsafe("INSERT INTO mailboxes(id,workspace_id,email,smtp_host,updated_at)VALUES($1::uuid,$2::uuid,'receipt@example.invalid','smtp.example.invalid',now())",mailbox,ws);
  const repo=new CampaignRecipientsRepository(new PrismaDispatchDatabase(db));const results=await Promise.all(Array.from({length:12},()=>repo.createCampaign(ws,input)));expect(new Set(results.map(r=>r!.id)).size).toBe(1);expect(results.filter(r=>!r!.replayed)).toHaveLength(1);const id=results[0]!.id;
  const original=(await db.$queryRawUnsafe<any[]>('SELECT * FROM campaigns WHERE id=$1::uuid',id))[0];expect(await db.$queryRawUnsafe('SELECT * FROM campaign_mailboxes WHERE campaign_id=$1::uuid',id)).toHaveLength(1);
  const reordered={...input,steps:[{bodyTemplate:'No sends',subject:'Synthetic',delayHours:0,stepNumber:1}],mailboxPoolIds:[mailbox]};expect(await new CampaignRecipientsRepository(new PrismaDispatchDatabase(db)).createCampaign(ws,reordered)).toMatchObject({id,replayed:true,status:'draft'});expect((await db.$queryRawUnsafe<any[]>('SELECT * FROM campaigns WHERE id=$1::uuid',id))[0]).toEqual(original);
  for(const changed of [{name:'Changed'}, {projectId:undefined},{steps:[{...input.steps[0],bodyTemplate:'Different'}]},{dailyLimitTotal:13}])await expect(repo.createCampaign(ws,{...input,...changed})).rejects.toBeInstanceOf(CampaignCreateConflict);
  await db.$executeRawUnsafe("UPDATE campaigns SET status='paused',name='Edited after create',updated_at=now() WHERE id=$1::uuid",id);expect(await repo.createCampaign(ws,input)).toMatchObject({id,replayed:true,status:'paused',name:'Edited after create'});
  expect(await repo.createCampaign(other,{...input,projectId:undefined,mailboxPoolIds:[]})).toMatchObject({replayed:false});expect((await repo.createCampaign(ws,{...input,requestId:undefined}))!.id).not.toBe(id);
  app=await createApplication({sessionKey:key,recipients:repo} as any);const server=app.getHttpAdapter().getInstance(),token=issueSession({workspaceId:ws,userId:randomUUID(),role:'admin'},key,3600).token,send=(payload:any)=>server.inject({method:'POST',url:'/workspace/campaigns',payload,headers:{authorization:'Bearer '+token}});
  expect((await send(input)).statusCode).toBe(200);expect((await send({...input,name:'Route mismatch'})).statusCode).toBe(409);expect((await send({...input,requestId:'bad'})).statusCode).toBe(400);
  const rollback={...input,requestId:randomUUID(),name:'Receipt failure'};const before=await db.campaign.count({where:{workspaceId:ws}});
  await db.$executeRawUnsafe(`CREATE FUNCTION ${tag}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.workspace_id='${ws}'::uuid THEN RAISE EXCEPTION 'Synthetic private campaign diagnostics'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER ${tag} BEFORE INSERT ON campaign_create_receipts FOR EACH ROW EXECUTE FUNCTION ${tag}()`);
  const failed=await send(rollback);expect(failed.statusCode).toBe(503);expect(failed.body).not.toContain('diagnostics');expect(await db.campaign.count({where:{workspaceId:ws}})).toBe(before);expect(await db.$queryRawUnsafe('SELECT * FROM campaign_create_receipts WHERE request_id=$1::uuid',rollback.requestId)).toEqual([]);
  await db.$executeRawUnsafe(`DROP TRIGGER ${tag} ON campaign_create_receipts`);expect((await send(rollback)).statusCode).toBe(201);expect((await send(rollback)).statusCode).toBe(200);
  await db.campaign.delete({where:{id}});expect((await send(input)).statusCode).toBe(409);expect(await db.$queryRawUnsafe('SELECT * FROM campaign_create_receipts WHERE workspace_id=$1::uuid AND request_id=$2::uuid',ws,input.requestId)).toHaveLength(1);expect(await db.outboundJob.count({where:{workspaceId:ws}})).toBe(0);
 }finally{await app?.close();await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${tag} ON campaign_create_receipts`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${tag}()`);await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});expect(await db.$queryRawUnsafe('SELECT * FROM campaign_create_receipts WHERE workspace_id=$1::uuid',ws)).toEqual([]);await db.$disconnect();}
},30000);
