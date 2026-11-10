import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AtomicDispatchRepository, type SqlConnection, type TransactionalDatabase } from '../atomic-dispatch.repository';

let pg:PGlite, repo:AtomicDispatchRepository;
let now:Date, workspaceId:string, campaignId:string, mailboxId:string;
const connection=(db:any):SqlConnection=>({query:async <T extends Record<string,unknown>>(sql:string,params:unknown[]=[])=> (await db.query(sql,params)).rows as T[]});
const enqueue=(key='lead-1',email='synthetic@example.invalid',date=now)=>repo.enqueue({workspaceId,campaignId,recipientEmail:email,idempotencyKey:key,stepNumber:1,scheduledAt:date});
const claim=()=>repo.claim({workspaceId,campaignId,mailboxId,now,nextDispatchAt:new Date(now.getTime()+45000)});
beforeEach(async()=>{
  pg=new PGlite({extensions:{vector}});
  for(const migration of ['20261110_init_v2','20261110_integrity']) await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`,import.meta.url)),'utf8'));
  const database:TransactionalDatabase={...connection(pg),transaction:operation=>pg.transaction(tx=>operation(connection(tx)))};
  now=new Date('2026-11-10T08:00:00Z'); workspaceId=randomUUID(); campaignId=randomUUID(); mailboxId=randomUUID();
  repo=new AtomicDispatchRepository(database,()=>now);
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)',[workspaceId,'Synthetic tenant',now]);
  await pg.query("INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,updated_at) VALUES ($1,$2,$3,'active',2,$4)",[campaignId,workspaceId,'Synthetic campaign',now]);
  await pg.query('INSERT INTO mailboxes (id,workspace_id,email,smtp_host,health_score,daily_send_limit,updated_at) VALUES ($1,$2,$3,$4,100,2,$5)',[mailboxId,workspaceId,'mailbox@example.invalid','smtp.example.invalid',now]);
  await pg.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)',[campaignId,mailboxId,workspaceId]);
},30000);
afterEach(async()=>{await pg?.close();});
describe('Atomic repository executes actual parameterized SQL on isolated PostgreSQL WASM',()=>{
  it('claims once, reserves quota, enforces cooldown then accepts the receipt',async()=>{
    const id=await enqueue(); const reservation=await claim(); expect(reservation?.id).toBe(id);
    await enqueue('lead-2','other@example.invalid'); expect(await claim()).toBeNull();
    expect((await repo.snapshot(workspaceId,campaignId))?.sentToday).toBe(1);
    await repo.finish(workspaceId,id,'accepted','synthetic-provider-id');
    const result=await pg.query<{status:string}>('SELECT status FROM outbound_jobs WHERE id=$1',[id]); expect(result.rows[0].status).toBe('accepted');
  });
  it('enforces daily quotas after cooldown elapses and resets by day',async()=>{
    await enqueue(); await claim(); now=new Date(now.getTime()+60000);
    await enqueue('lead-2','second@example.invalid'); expect(await claim()).not.toBeNull(); now=new Date(now.getTime()+60000);
    await enqueue('lead-3','third@example.invalid'); expect(await claim()).toBeNull();
    now=new Date('2026-11-11T08:00:00Z'); expect(await claim()).not.toBeNull();
  });
  it('cancels suppressed recipients and never claims them',async()=>{
    const id=await enqueue(); await repo.suppress(workspaceId,' SYNTHETIC@example.invalid ');
    expect(await claim()).toBeNull();
    expect((await pg.query<{status:string}>('SELECT status FROM outbound_jobs WHERE id=$1',[id])).rows[0].status).toBe('cancelled');
  });
  it('skips a future-due message without consuming quota',async()=>{
    await enqueue('future','future@example.invalid',new Date(now.getTime()+600000));
    expect(await claim()).toBeNull(); expect((await repo.snapshot(workspaceId,campaignId))?.sentToday).toBe(0);
  });
  it('makes enqueue idempotent but rejects different payloads with the same key',async()=>{
    const id=await enqueue(); expect(await enqueue()).toBe(id);
    await expect(enqueue('lead-1','different@example.invalid')).rejects.toThrow('Idempotency conflict');
  });
  it('serializes competing claims without double reservation on a single SQL engine',async()=>{
    await enqueue(); const claims=await Promise.all([claim(),claim()]); expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await repo.snapshot(workspaceId,campaignId))?.sentToday).toBe(1);
  });
  it('rejects foreign tenant claims and receipts',async()=>{
    const id=await enqueue();
    expect(await repo.claim({workspaceId:randomUUID(),campaignId,mailboxId,now,nextDispatchAt:new Date(now.getTime()+45000)})).toBeNull();
    await claim(); await expect(repo.finish(randomUUID(),id,'accepted')).rejects.toThrow('reconciliation');
  });
  it('does not automatically retry an uncertain accepted-or-failed provider call',async()=>{
    const id=await enqueue(); await claim(); await repo.finish(workspaceId,id,'uncertain'); now=new Date(now.getTime()+60000);
    expect(await claim()).toBeNull(); expect((await repo.snapshot(workspaceId,campaignId))?.sentToday).toBe(1);
  });
});
