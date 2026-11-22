import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {PrismaDispatchDatabase} from '../prisma-database';
import {AtomicDispatchRepository} from '../atomic-dispatch.repository';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native concurrent exact-review approvals count one winner and stale copy/sender reviews cannot approve',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),cid=randomUUID(),mail1=randomUUID(),mail2=randomUUID(),now=new Date();
 try{
  await db.workspace.create({data:{id:ws,name:'Native reviewed approval'}});
  await db.$executeRawUnsafe("INSERT INTO campaigns(id,workspace_id,name,status,steps,updated_at)VALUES($1::uuid,$2::uuid,'Reviewed fixture','active',$3::jsonb,now())",cid,ws,JSON.stringify([{stepNumber:1,subject:'Native review A',bodyTemplate:'Exact native body A'}]));
  for(const id of [mail1,mail2])await db.$executeRawUnsafe("INSERT INTO mailboxes(id,workspace_id,email,smtp_host,updated_at)VALUES($1::uuid,$2::uuid,$3,'smtp.example.invalid',now())",id,ws,id+'@example.invalid');
  await db.$executeRawUnsafe('INSERT INTO campaign_mailboxes(campaign_id,mailbox_id,workspace_id)VALUES($1::uuid,$2::uuid,$3::uuid)',cid,mail1,ws);
  const repo=new AtomicDispatchRepository(new PrismaDispatchDatabase(db),()=>now),id=await repo.enqueue({workspaceId:ws,campaignId:cid,recipientEmail:'native-review@example.invalid',idempotencyKey:randomUUID(),stepNumber:1,scheduledAt:now}),a=(await repo.listPendingApprovals(ws))[0];
  await db.$executeRawUnsafe('UPDATE campaigns SET steps=$2::jsonb WHERE id=$1::uuid',cid,JSON.stringify([{stepNumber:1,subject:'Native unseen B',bodyTemplate:'Exact native body B'}]));
  expect(await repo.approve(ws,{jobIds:[id],expectedRevisions:{[id]:a.reviewRevision}})).toEqual({approvedCount:0,staleCount:1});const b=(await repo.listPendingApprovals(ws))[0];expect(b.reviewRevision).not.toBe(a.reviewRevision);
  expect((await repo.approve(ws,{jobIds:[id],expectedRevisions:{[id]:a.reviewRevision}})).approvedCount).toBe(0);
  await db.$executeRawUnsafe('INSERT INTO campaign_mailboxes(campaign_id,mailbox_id,workspace_id)VALUES($1::uuid,$2::uuid,$3::uuid)',cid,mail2,ws);expect((await repo.setSenderMailbox(ws,id,mail2)).ok).toBe(true);
  expect((await repo.approve(ws,{jobIds:[id],expectedRevisions:{[id]:b.reviewRevision}})).approvedCount).toBe(0);const pinned=(await repo.listPendingApprovals(ws))[0];expect(pinned.senderMailboxIds).toEqual([mail2]);
  const contenders=await Promise.all([1,2].map(()=>repo.approve(ws,{jobIds:[id],expectedRevisions:{[id]:pinned.reviewRevision}})));expect(contenders.reduce((sum,r)=>sum+r.approvedCount,0)).toBe(1);
  const row=await db.outboundJob.findUnique({where:{id}});expect(row?.status).toBe('approved');expect(row?.reservedAt).toBeNull();expect((await repo.releaseApproved(ws,cid)).released).toBe(0);
 }finally{await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
},30000);
