import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {PrismaClient} from '@leadloom/database';
import {AtomicDispatchRepository} from '../atomic-dispatch.repository';
import {PrismaDispatchDatabase} from '../prisma-database';
import {PrismaSeenMessageStore} from '../transport/prisma-seen-store';
import {ImapReplyPoller,InMemorySeenMessageStore,replyDedupeKey} from '../transport/imap-poller';
import {createImapflowClient} from '../transport/client-factories';
import {pollMailboxReplies} from '../poll-bridge';
const url=process.env.LEADLOOM_TEST_DATABASE_URL,run=process.env.LEADLOOM_INTEGRATION==='1'&&Boolean(url),enabled={LEADLOOM_IMAP_POLL_ENABLED:'true'};
async function fixture(fn:(f:any)=>Promise<void>){
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),mb=randomUUID(),campaign=randomUUID(),tag='ack_'+randomUUID().replaceAll('-',''),now=new Date();let target:string|null=null;
 try{
  await db.workspace.create({data:{id:ws,name:'Synthetic inbound acknowledgement'}});await db.mailbox.create({data:{id:mb,workspaceId:ws,email:'sender@example.invalid',smtpHost:'smtp.example.invalid'}});await db.$executeRawUnsafe("INSERT INTO campaigns(id,workspace_id,name,status,steps,updated_at)VALUES($1::uuid,$2::uuid,'Synthetic ack','active','[]',now())",campaign,ws);await db.$executeRawUnsafe('INSERT INTO campaign_mailboxes(campaign_id,mailbox_id,workspace_id)VALUES($1::uuid,$2::uuid,$3::uuid)',campaign,mb,ws);
  const repo=new AtomicDispatchRepository(new PrismaDispatchDatabase(db));const jobs=[];for(let i=1;i<=2;i++)jobs.push(await repo.enqueue({workspaceId:ws,campaignId:campaign,recipientEmail:'lead'+i+'@example.invalid',idempotencyKey:'ack-'+i,stepNumber:1,scheduledAt:now}));
  const seen=new PrismaSeenMessageStore(db),messages=[1,2].map(uid=>({uid,messageId:'ack-'+uid+'@example.invalid',fromEmail:'lead'+uid+'@example.invalid',subject:'Reply',bodyText:'Please stop contacting me',receivedAt:now}));let fetches=0;const client={fetchBatch:async(since:number)=>{fetches++;return{uidValidity:11,messages:messages.filter(m=>m.uid>since)};},fetchSince:async(since:number)=>messages.filter(m=>m.uid>since)};
  const clear=async()=>{if(target){await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${tag} ON ${target}`);target=null;}await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${tag}()`);};
  const fail=async(table:string,condition:string)=>{await clear();target=table;await db.$executeRawUnsafe(`CREATE FUNCTION ${tag}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'Synthetic inbound acknowledgement failure'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER ${tag} BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION ${tag}()`);};
  const poll=(handler=repo,customClient=client)=>pollMailboxReplies(handler,new ImapReplyPoller(customClient,new PrismaSeenMessageStore(db)),ws,mb,campaign,enabled);
  const markers=()=>db.$queryRawUnsafe('SELECT message_id FROM outreach_events WHERE mailbox_id=$1::uuid AND type=\'reply_received\'',mb);
  const statuses=async()=>(await db.$queryRawUnsafe<any[]>('SELECT status FROM outbound_jobs WHERE workspace_id=$1::uuid ORDER BY id',ws)).map(r=>r.status);
  await fn({db,ws,mb,campaign,repo,jobs,seen,messages,client,poll,markers,statuses,fail,clear,fetches:()=>fetches});
 }finally{if(target)await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${tag} ON ${target}`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${tag}()`);await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
}
it.skipIf(!run)('native reply failure leaves markers/checkpoint unacknowledged; fresh instances recover every reply and halt',async()=>fixture(async f=>{
 await f.fail('inbound_replies',`NEW.workspace_id='${f.ws}'::uuid`);await expect(f.poll()).rejects.toThrow();expect(await f.seen.lastUid(f.mb)).toBe(0);expect(await f.markers()).toEqual([]);expect(await f.repo.listInboundReplies(f.ws)).toEqual([]);expect(await f.statuses()).toEqual(['pending_approval','pending_approval']);
 await f.clear();expect(await f.poll()).toMatchObject({fetched:2,recorded:2,duplicates:0,haltedJobIds:expect.arrayContaining(f.jobs)});expect(await f.seen.lastUid(f.mb)).toBe(2);expect((await f.repo.listInboundReplies(f.ws)).length).toBe(2);expect(await f.statuses()).toEqual(['cancelled','cancelled']);expect(await f.poll()).toMatchObject({fetched:0,recorded:0,haltedJobIds:[]});
}),30000);
it.skipIf(!run)('native partial consumer failure replays committed first reply idempotently and records the unhandled second reply',async()=>fixture(async f=>{
 await f.fail('inbound_replies',`NEW.workspace_id='${f.ws}'::uuid AND NEW.message_id='ack-2@example.invalid'`);await expect(f.poll()).rejects.toThrow();expect(await f.seen.lastUid(f.mb)).toBe(0);expect(await f.markers()).toEqual([]);expect((await f.repo.listInboundReplies(f.ws)).map((r:any)=>r.messageId)).toEqual(['ack-1@example.invalid']);expect((await f.statuses()).sort()).toEqual(['cancelled','pending_approval']);
 await f.clear();const recovered=await f.poll();expect(recovered).toMatchObject({fetched:2,recorded:1,duplicates:1,haltedJobIds:[f.jobs[1]]});expect(await f.seen.lastUid(f.mb)).toBe(2);expect((await f.markers()).length).toBe(2);expect((await f.repo.listInboundReplies(f.ws)).length).toBe(2);expect(await f.statuses()).toEqual(['cancelled','cancelled']);
}),30000);
it.skipIf(!run)('native marker transaction rollback after durable handling replays without double inserts or halts',async()=>fixture(async f=>{
 await f.fail('mailbox_sync_state',`NEW.mailbox_id='${f.mb}'::uuid AND NEW.last_inbound_uid>0`);await expect(f.poll()).rejects.toThrow();expect(await f.seen.lastUid(f.mb)).toBe(0);expect(await f.markers()).toEqual([]);expect((await f.repo.listInboundReplies(f.ws)).length).toBe(2);expect(await f.statuses()).toEqual(['cancelled','cancelled']);
 await f.clear();expect(await f.poll()).toMatchObject({fetched:2,recorded:0,duplicates:2,haltedJobIds:[]});expect(await f.seen.lastUid(f.mb)).toBe(2);expect((await f.markers()).length).toBe(2);expect((await f.repo.listInboundReplies(f.ws)).length).toBe(2);
}),30000);
it.skipIf(!run)('native mailbox lock covers consumer acknowledgement; concurrent poll returns busy without fetching',async()=>fixture(async f=>{
 let release!:()=>void,entered!:()=>void;const hold=new Promise<void>(r=>release=r),inside=new Promise<void>(r=>entered=r);const handler={recordInboundReply:async(...args:any[])=>{entered();await hold;return f.repo.recordInboundReply(...args);}};
 const first=f.poll(handler);try{await inside;expect(await f.seen.lastUid(f.mb)).toBe(0);expect(await f.poll()).toBeNull();expect(f.fetches()).toBe(1);}finally{release();}expect(await first).toMatchObject({recorded:2});expect(await f.seen.lastUid(f.mb)).toBe(2);
}),30000);
it('gated bridge refuses legacy unacknowledged pollers before fetch, disabled gate does nothing',async()=>{
 let fetched=0;const legacy:any={pollOnce:async()=>{fetched++;return[];}},repo:any={recordInboundReply:async()=>{throw Error('Should not record');}};
 expect(await pollMailboxReplies(repo,legacy,randomUUID(),randomUUID(),randomUUID(),{})).toBeNull();await expect(pollMailboxReplies(repo,legacy,randomUUID(),randomUUID(),randomUUID(),enabled)).rejects.toThrow('Acknowledged reply poller required');expect(fetched).toBe(0);
});
it('fallback store acknowledges neither individual markers nor UID before consumer success',async()=>{
 const seen=new InMemorySeenMessageStore() as any;seen.persistBatch=undefined;const mb=randomUUID(),context={mailboxId:mb,campaignId:randomUUID()},raw={uid:1,messageId:'fallback@example.invalid',fromEmail:'lead@example.invalid',subject:'Reply',bodyText:'Stop',receivedAt:new Date()},client={fetchSince:async()=>[raw]},poller=new ImapReplyPoller(client,seen);
 await expect(poller.pollAndConsume(context,async()=>{throw Error('Consumer failed');})).rejects.toThrow('Consumer failed');expect(await seen.has(mb,replyDedupeKey(raw,undefined))).toBe(false);expect(await seen.lastUid(mb)).toBe(0);expect(await poller.pollAndConsume(context,async events=>events.length)).toBe(1);expect(await seen.lastUid(mb)).toBe(1);
});
it.skipIf(!run||!process.env.LEADLOOM_SMTP_SERVER_MODULE)('real read-only IMAP fixture and native reply bridge recover after database refusal without marking mail read',async()=>fixture(async f=>{
 const hc=createRequire(process.env.LEADLOOM_SMTP_SERVER_MODULE!)('hoodiecrow-imap'),raw='Message-ID: <wire-ack@example.invalid>\r\nFrom: lead1@example.invalid\r\nTo: sender@example.invalid\r\nSubject: Re: outreach\r\nDate: Mon, 02 Nov 2026 10:00:00 +0000\r\n\r\nPlease stop contacting me\r\n';
 const imap=hc({users:{u:{password:'p'}},storage:{INBOX:{messages:[{raw,flags:[]}]}}});await new Promise<void>(r=>imap.listen(2151,'127.0.0.1',r));
 try{
  const client=await createImapflowClient({host:'127.0.0.1',port:2151,user:'u',password:'p',authType:'password',plaintextForTestsOnly:true});await f.fail('inbound_replies',`NEW.workspace_id='${f.ws}'::uuid`);await expect(f.poll(f.repo,client)).rejects.toThrow();expect(await f.seen.lastUid(f.mb)).toBe(0);expect((await f.repo.listInboundReplies(f.ws)).length).toBe(0);await f.clear();expect(await f.poll(f.repo,client)).toMatchObject({recorded:1,haltedJobIds:[f.jobs[0]]});expect(await f.seen.lastUid(f.mb)).toBe(1);expect(await f.poll(f.repo,client)).toMatchObject({fetched:0});
  const {ImapFlow}=await import('imapflow'),probe=new ImapFlow({host:'127.0.0.1',port:2151,secure:false,auth:{user:'u',pass:'p'},logger:false}as any);try{await probe.connect();await probe.mailboxOpen('INBOX',{readOnly:true});for await(const message of probe.fetch('1:*',{flags:true}))expect(Array.from(message.flags??[])).not.toContain('\\Seen');}finally{await probe.logout();}
 }finally{await new Promise<void>(r=>imap.close(r));}
}),30000);

it.skipIf(!run)('missing Message-ID fallback is unique per mailbox and UIDVALIDITY in native workspace reply storage',async()=>fixture(async f=>{
 const other=randomUUID();await f.db.mailbox.create({data:{id:other,workspaceId:f.ws,email:'other@example.invalid',smtpHost:'smtp.example.invalid'}});await f.db.$executeRawUnsafe('INSERT INTO campaign_mailboxes(campaign_id,mailbox_id,workspace_id)VALUES($1::uuid,$2::uuid,$3::uuid)',f.campaign,other,f.ws);
 const client=(fromEmail:string,validity=11)=>({fetchSince:async()=>[],fetchBatch:async(since:number)=>({uidValidity:validity,messages:since>0?[]:[{...f.messages[0],messageId:'',fromEmail}]})});
 expect(await f.poll(f.repo,client('lead1@example.invalid'))).toMatchObject({recorded:1,haltedJobIds:[f.jobs[0]]});
 expect(await pollMailboxReplies(f.repo,new ImapReplyPoller(client('lead2@example.invalid'),new PrismaSeenMessageStore(f.db)),f.ws,other,f.campaign,enabled)).toMatchObject({recorded:1,haltedJobIds:[f.jobs[1]]});expect((await f.repo.listInboundReplies(f.ws)).length).toBe(2);
 expect(await pollMailboxReplies(f.repo,new ImapReplyPoller(client('lead2@example.invalid',12),new PrismaSeenMessageStore(f.db)),f.ws,other,f.campaign,enabled)).toMatchObject({recorded:1});const saved=await f.repo.listInboundReplies(f.ws);expect(new Set(saved.map((r:any)=>r.messageId)).size).toBe(3);expect(saved.every((r:any)=>r.messageId.startsWith('imap:'))).toBe(true);
}),30000);
it.skipIf(!run||!process.env.LEADLOOM_SMTP_SERVER_MODULE)('real IMAP References-only reply disambiguates the exact native campaign without halting its other campaign',async()=>fixture(async f=>{
 const second=randomUUID();await f.db.$executeRawUnsafe("INSERT INTO campaigns(id,workspace_id,name,status,steps,updated_at)VALUES($1::uuid,$2::uuid,'References target','active','[]',now())",second,f.ws);await f.db.$executeRawUnsafe('INSERT INTO campaign_mailboxes(campaign_id,mailbox_id,workspace_id)VALUES($1::uuid,$2::uuid,$3::uuid)',second,f.mb,f.ws);const job=await f.repo.enqueue({workspaceId:f.ws,campaignId:second,recipientEmail:'lead1@example.invalid',idempotencyKey:'references-target',stepNumber:1,scheduledAt:new Date()});await f.db.$executeRawUnsafe("UPDATE outbound_jobs SET provider_message_id='target-references@example.invalid' WHERE id=$1::uuid",job);
 const hc=createRequire(process.env.LEADLOOM_SMTP_SERVER_MODULE!)('hoodiecrow-imap'),imap=hc({users:{u:{password:'p'}},storage:{INBOX:{messages:[{raw:'Message-ID: <references-reply@example.invalid>\r\nFrom: lead1@example.invalid\r\nTo: sender@example.invalid\r\nReferences: <earlier@example.invalid>\r\n <target-references@example.invalid>\r\nSubject: References only\r\n\r\nPlease stop contacting me\r\n',flags:[]}]}}});await new Promise<void>(r=>imap.listen(2154,'127.0.0.1',r));try{const client=await createImapflowClient({host:'127.0.0.1',port:2154,user:'u',password:'p',authType:'password',plaintextForTestsOnly:true});expect(await f.poll(f.repo,client)).toMatchObject({recorded:1,ambiguous:0,haltedJobIds:[job]});const replies=await f.repo.listInboundReplies(f.ws);expect(replies[0]).toMatchObject({campaignId:second,attribution:'thread_header'});expect((await f.db.$queryRawUnsafe('SELECT status FROM outbound_jobs WHERE id=$1::uuid',f.jobs[0]))[0].status).toBe('pending_approval');}finally{await new Promise<void>(r=>imap.close(r));}
}),30000);
