import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {CampaignRecipientsRepository,CampaignPoolConflict} from '../campaign-recipients.repository';
import {PrismaDispatchDatabase} from '../prisma-database';
import {AtomicDispatchRepository} from '../atomic-dispatch.repository';
import {createApplication} from '../../../main';
import {issueSession} from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native atomic sender pool CAS, rollback, re-review of approved/released work and reservation race boundary',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),other=randomUUID(),a=randomUUID(),b=randomUUID(),c=randomUUID(),foreign=randomUUID(),tag='pool_fail_'+randomUUID().replaceAll('-',''),now=new Date(),key=Buffer.alloc(32,6);let app:any;
 try{
  await db.workspace.createMany({data:[{id:ws,name:'Sender pool fixture'},{id:other,name:'Foreign fixture'}]});for(const [id,w]of [[a,ws],[b,ws],[c,ws],[foreign,other]])await db.$executeRawUnsafe("INSERT INTO mailboxes(id,workspace_id,email,smtp_host,health_score,daily_send_limit,updated_at)VALUES($1::uuid,$2::uuid,$3,'smtp.example.invalid',100,100,now())",id,w,id+'@example.invalid');
  const adapter=new PrismaDispatchDatabase(db),repo=new CampaignRecipientsRepository(adapter),dispatch=new AtomicDispatchRepository(adapter,()=>now,{sendingEnabled:true});const campaign=(await repo.createCampaign(ws,{name:'Atomic sender pool',steps:[{stepNumber:1,delayHours:0,subject:'Synthetic',bodyTemplate:'No sends'}],dailyLimitTotal:100,scheduleTimezone:'UTC',mailboxPoolIds:[a]}))!,id=campaign.id;
  await db.campaign.update({where:{id},data:{status:'active'}});
  const job=async()=>dispatch.enqueue({workspaceId:ws,campaignId:id,recipientEmail:randomUUID()+'@example.invalid',idempotencyKey:randomUUID(),stepNumber:1,scheduledAt:now});
  const approved=await job(),pending=await job();expect((await dispatch.approve(ws,{jobIds:[approved,pending]})).approvedCount).toBe(2);expect((await dispatch.releaseApproved(ws,id)).released).toBe(2);await db.$executeRawUnsafe("UPDATE outbound_jobs SET status='approved' WHERE id=$1::uuid",approved);
  const changed=(await repo.setMailboxPool(ws,id,[b,b],[a]))!;expect(changed.pool.map(m=>m.id)).toEqual([b]);expect(changed.invalidatedCount).toBe(2);expect((await db.outboundJob.findMany({where:{campaignId:id}})).map(j=>j.status)).toEqual(['pending_approval','pending_approval']);expect(await dispatch.claim({workspaceId:ws,campaignId:id,mailboxId:b,now,nextDispatchAt:new Date(+now+45000)})).toBeNull();
  expect((await dispatch.approve(ws,{jobIds:[approved,pending]})).staleCount).toBe(2);expect((await dispatch.approve(ws,{jobIds:[approved,pending]})).approvedCount).toBe(2);
  const before=await db.outboundJob.findMany({where:{campaignId:id},orderBy:{id:'asc'}});expect((await repo.setMailboxPool(ws,id,[b],[a]))!.unchanged).toBe(true);expect(await db.outboundJob.findMany({where:{campaignId:id},orderBy:{id:'asc'}})).toEqual(before);
  await expect(repo.setMailboxPool(ws,id,[c],[a])).rejects.toBeInstanceOf(CampaignPoolConflict);expect(await repo.setMailboxPool(ws,id,[foreign],[b])).toBeNull();expect((await repo.listMailboxPool(ws,id)).map(m=>m.id)).toEqual([b]);
  // Failing after the pool write and during approval invalidation must roll everything back.
  await db.$executeRawUnsafe(`CREATE FUNCTION ${tag}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.workspace_id='${ws}'::uuid THEN RAISE EXCEPTION 'Synthetic private pool diagnostic'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER ${tag} BEFORE UPDATE ON outbound_jobs FOR EACH ROW EXECUTE FUNCTION ${tag}()`);
  app=await createApplication({sessionKey:key,recipients:repo} as any);const server=app.getHttpAdapter().getInstance(),token=issueSession({workspaceId:ws,userId:randomUUID(),role:'admin'},key,3600).token,put=(payload:any)=>server.inject({method:'PUT',url:'/campaigns/'+id+'/mailboxes',payload,headers:{authorization:'Bearer '+token}});
  const failed=await put({mailboxIds:[a,c],expectedMailboxIds:[b]});expect(failed.statusCode).toBe(503);expect(failed.body).not.toContain('diagnostic');expect((await repo.listMailboxPool(ws,id)).map(m=>m.id)).toEqual([b]);expect(await db.outboundJob.findMany({where:{campaignId:id},orderBy:{id:'asc'}})).toEqual(before);await db.$executeRawUnsafe(`DROP TRIGGER ${tag} ON outbound_jobs`);
  expect((await put({mailboxIds:[a],expectedMailboxIds:[c]})).statusCode).toBe(409);expect((await put({mailboxIds:[a],expectedMailboxIds:['bad']})).statusCode).toBe(400);
  const simultaneous=await Promise.allSettled([[a],[c]].map(ids=>repo.setMailboxPool(ws,id,ids,[b])));expect(simultaneous.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(simultaneous.filter(r=>r.status==='rejected')).toHaveLength(1);expect(await repo.listMailboxPool(ws,id)).toHaveLength(1);
  // Release and sender edit serialize: whether release or edit wins first, no old approval stays pending.
  await repo.setMailboxPool(ws,id,[a]);await dispatch.approve(ws,{jobIds:[approved,pending]});await dispatch.approve(ws,{jobIds:[approved,pending]});await Promise.all([dispatch.releaseApproved(ws,id),repo.setMailboxPool(ws,id,[b])]);expect((await db.outboundJob.findMany({where:{campaignId:id}})).every(j=>j.status==='pending_approval')).toBe(true);
  // Force the edit to hold the campaign lock while another connection attempts reservation.
  await dispatch.approve(ws,{jobIds:[approved,pending]});await dispatch.approve(ws,{jobIds:[approved,pending]});await dispatch.releaseApproved(ws,id);
  let entered!:()=>void,unblock!:()=>void;const inside=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>unblock=r);
  const gated={query:adapter.query.bind(adapter),transaction:async(operation:any)=>adapter.transaction(tx=>operation({query:async(sql:string,args?:unknown[])=>{if(sql.startsWith('DELETE FROM campaign_mailboxes')){entered();await gate;}return tx.query(sql,args);}}))};
  const editing=new CampaignRecipientsRepository(gated).setMailboxPool(ws,id,[c],[b]);await inside;let settled=false;const claiming=dispatch.claim({workspaceId:ws,campaignId:id,mailboxId:b,now,nextDispatchAt:new Date(+now+45000)}).finally(()=>{settled=true;});await new Promise(r=>setTimeout(r,80));expect(settled).toBe(false);unblock();expect((await editing)?.pool.map(m=>m.id)).toEqual([c]);expect(await claiming).toBeNull();expect((await db.outboundJob.findMany({where:{campaignId:id}})).every(j=>j.status==='pending_approval')).toBe(true);await repo.setMailboxPool(ws,id,[b],[c]);
  // A reservation that already happened is honestly reported, never claimed recalled.
  await dispatch.approve(ws,{jobIds:[approved,pending]});await dispatch.approve(ws,{jobIds:[approved,pending]});await dispatch.releaseApproved(ws,id);const reserved=await dispatch.claim({workspaceId:ws,campaignId:id,mailboxId:b,now,nextDispatchAt:new Date(+now+45000)});expect(reserved).not.toBeNull();const edited=(await repo.setMailboxPool(ws,id,[c],[b]))!;expect(edited.reservedCount).toBe(1);expect(edited.invalidatedCount).toBe(1);expect((await db.outboundJob.findUnique({where:{id:reserved!.id}}))!.status).toBe('reserved');
  expect((await db.outboundJob.findMany({where:{campaignId:id}})).some(j=>j.status==='accepted')).toBe(false);
 }finally{await app?.close();await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${tag} ON outbound_jobs`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${tag}()`);await db.workspace.deleteMany({where:{id:{in:[ws,other]}}});await db.$disconnect();}
},30000);
