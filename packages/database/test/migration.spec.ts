import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Real PostgreSQL SQL engine in WASM, in-memory and synthetic only. This is not
// a native PostgreSQL 16 / Prisma integration test or a production migration run.
let db: PGlite;
const a = randomUUID(), b = randomUUID(), ta = randomUUID(), tb = randomUUID();
const row = randomUUID(), col = randomUUID(), otherCol = randomUUID();
const campaign = randomUUID(), mailbox = randomUUID(), otherMailbox = randomUUID();
const now = new Date();
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity']) {
    await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  for (const id of [a, b]) await db.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [id, 'Synthetic tenant', now]);
  for (const [id, tenant] of [[ta, a], [tb, b]]) await db.query('INSERT INTO tables (id,workspace_id,name,updated_at) VALUES ($1,$2,$3,$4)', [id, tenant, 'Synthetic table', now]);
  await db.query('INSERT INTO rows (id,table_id,order_index) VALUES ($1,$2,0)', [row, ta]);
  for (const [id, table] of [[col, ta], [otherCol, tb]]) await db.query('INSERT INTO columns (id,table_id,name,type,order_index) VALUES ($1,$2,$3,$4,0)', [id, table, 'Email', 'email']);
  await db.query('INSERT INTO campaigns (id,workspace_id,table_id,name,updated_at) VALUES ($1,$2,$3,$4,$5)', [campaign, a, ta, 'Synthetic campaign', now]);
  for (const [id, tenant] of [[mailbox, a], [otherMailbox, b]]) await db.query('INSERT INTO mailboxes (id,workspace_id,email,smtp_host,updated_at) VALUES ($1,$2,$3,$4,$5)', [id, tenant, 'synthetic@example.invalid', 'smtp.example.invalid', now]);
}, 30_000);
afterAll(async () => { await db?.close(); });

describe('Generated migration SQL + integrity constraints (PGlite)', () => {
  it('creates all 15 registry tables and the necessary campaign-mailbox join', async () => {
    const result = await db.query<{ name: string }>("SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'");
    expect(result.rows.map(r => r.name).sort()).toEqual(['workspaces','users','tables','columns','rows','cells','validation_experiments','smoke_test_pages','waitlist_leads','byok_credentials','enrichment_cache','campaigns','mailboxes','outreach_events','suppression_list','campaign_mailboxes','outbound_jobs','campaign_daily_usage','mailbox_daily_usage'].sort());
    const extension = await db.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    expect(extension.rows).toHaveLength(1);
  });
  it('allows a cell inside its own table', async () => {
    await db.query('INSERT INTO cells (id,table_id,row_id,column_id,updated_at) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),ta,row,col,now]);
  });
  it('rejects cell substitution into another tenant table', async () => {
    await expect(db.query('INSERT INTO cells (id,table_id,row_id,column_id,updated_at) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),ta,row,otherCol,now])).rejects.toMatchObject({ code: '23503' });
  });
  it('rejects campaign/table tenant mismatch', async () => {
    await expect(db.query('INSERT INTO campaigns (id,workspace_id,table_id,name,updated_at) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),a,tb,'Forbidden cross-tenant',now])).rejects.toMatchObject({ code: '23503' });
  });
  it('persists same-tenant mailbox pools and rejects foreign mailboxes', async () => {
    await db.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)', [campaign,mailbox,a]);
    await expect(db.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)', [campaign,otherMailbox,a])).rejects.toMatchObject({ code: '23503' });
  });
  it('keeps identical suppression hashes independent by workspace', async () => {
    for (const tenant of [a, b]) await db.query('INSERT INTO suppression_list (id,workspace_id,email_hash) VALUES ($1,$2,$3)', [randomUUID(),tenant,'a'.repeat(64)]);
    await expect(db.query('INSERT INTO suppression_list (id,workspace_id,email_hash) VALUES ($1,$2,$3)', [randomUUID(),a,'a'.repeat(64)])).rejects.toMatchObject({ code: '23505' });
  });
  it('rejects plaintext email in suppression hash field', async () => {
    await expect(db.query('INSERT INTO suppression_list (id,workspace_id,email_hash) VALUES ($1,$2,$3)', [randomUUID(),a,'synthetic@example.invalid'])).rejects.toMatchObject({ code: '23514' });
  });
  it('rejects malformed envelope byte lengths', async () => {
    await expect(db.query('INSERT INTO byok_credentials (id,workspace_id,provider,masked_key,encrypted_key_ciphertext,iv,auth_tag,wrapped_dek,dek_iv,dek_auth_tag,updated_at) VALUES ($1,$2,$3,$11,$4,$5,$6,$7,$8,$9,$10)', [randomUUID(),a,'openai',new Uint8Array(20),new Uint8Array(4),new Uint8Array(16),new Uint8Array(32),new Uint8Array(12),new Uint8Array(16),now,'masked'])).rejects.toMatchObject({ code: '23514' });
  });
});
