import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import assert from 'node:assert/strict';
import {TableImportService,TableImportTargetDeleted} from '../../engine/src/modules/workspace-read/table-import.service';

// Disposable-data rehearsal only. No production defaults or credentials.
const source = readFileSync('/tmp/leadloom-native-db-url.txt', 'utf8');
const fixtureSource = new URL(source);
assert.equal(fixtureSource.hostname, 'localhost');
assert.equal(fixtureSource.port, '56539');
assert(fixtureSource.pathname.startsWith('/leadloom_whole_'));
assert((fixtureSource.searchParams.get('host') ?? '').startsWith('/tmp/leadloom-'));
const targetName = 'leadloom_restore_' + randomUUID().replaceAll('-', '');
const target = new URL(source); target.pathname = '/' + targetName;
const adminUrl = new URL(source); adminUrl.pathname = '/postgres';
const dumpPath = '/tmp/leadloom-synthetic-restore-rehearsal.dump';
const bin = '/tmp/pg16pkg/root/usr/lib/postgresql/16/bin/';
const admin = new pg.Client({ connectionString: adminUrl.href });
let created = false;
function command(name: string, args: string[]) {
  const r = spawnSync(bin + name, args, { encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw Error(name + ' failed: ' + r.stderr);
  return r.stdout;
}
const ident = (s: string) => '"' + s.replaceAll('"', '""') + '"';
async function inventory(url: string) {
  const db = new pg.Client({ connectionString: url }); await db.connect();
  try {
    const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const rows = [];
    for (const t of tables) {
      const r = await db.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(hash, '' ORDER BY hash),'')) AS digest FROM (SELECT md5(to_jsonb(t)::text) AS hash FROM public.${ident(t.tablename)} t) x`);
      rows.push({ table: t.tablename, ...r.rows[0] });
    }
    const indexes = (await db.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows;
    const constraints = (await db.query("SELECT conrelid::regclass::text AS relation, conname, contype, convalidated, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2")).rows;
    const extensions = (await db.query('SELECT extname,extversion FROM pg_extension ORDER BY extname')).rows;
    return { rows, indexes, constraints, extensions };
  } finally { await db.end(); }
}
try {
  await admin.connect();
  const before = await inventory(source);
  command('pg_dump', ['--dbname', source, '--format=custom', '--no-owner', '--no-privileges', '--file', dumpPath]);
  await admin.query('CREATE DATABASE ' + ident(targetName)); created = true;
  command('pg_restore', ['--dbname', target.href, '--exit-on-error', '--no-owner', '--no-privileges', dumpPath]);
  const after = await inventory(target.href);
  assert.deepEqual(after.rows, before.rows);
  assert.deepEqual(after.indexes, before.indexes);
  assert.deepEqual(after.extensions, before.extensions);
  const shape = (items: any[]) => items.map(({ definition, ...item }) => item);
  assert.deepEqual(shape(after.constraints), shape(before.constraints));
  // PostgreSQL may reparse equivalent CHECK expressions on restore, changing
  // parentheses/cast spelling. Record these differences instead of pretending
  // a textual definition comparison is a semantic equivalence proof.
  const deparseChanges = before.constraints.filter((c, i) => c.definition !== after.constraints[i].definition).map((c) => c.conname);
  const client = new PrismaClient({ datasources: { db: { url: target.href } } });
  try { await client.$queryRawUnsafe('SELECT 1');const tombstones=await client.$queryRawUnsafe<any[]>('SELECT r.workspace_id,r.request_id,r.project_id,r.table_id FROM table_import_receipts r JOIN projects p ON p.id=r.project_id AND p.workspace_id=r.workspace_id LEFT JOIN tables t ON t.id=r.table_id WHERE t.id IS NULL AND p.slug=$1','alpha');assert.equal(tombstones.length,1);const receipt=tombstones[0];await assert.rejects(()=>new TableImportService(client).import(receipt.workspace_id,{requestId:receipt.request_id,name:'Alpha project caller dataset',columns:['Company','Code'],rows:[['Alpha caller research','00123']]},receipt.project_id),TableImportTargetDeleted);assert.equal((await client.$queryRawUnsafe<any[]>('SELECT count(*)::int AS n FROM tables WHERE id=$1::uuid',receipt.table_id))[0].n,0); } finally { await client.$disconnect(); }
  const test = spawnSync(process.execPath, [new URL('../../../node_modules/vitest/vitest.mjs', import.meta.url).pathname, 'run', '--maxWorkers', '1', '--minWorkers', '1', 'src/modules/validator/__tests__/waitlist-capture.integration.spec.ts','src/modules/validator/__tests__/reviewed-publication.native.spec.ts', 'src/modules/provisioning/__tests__/prisma-provisioning-store.integration.spec.ts', 'src/modules/password-auth/__tests__/prisma-password-store.integration.spec.ts', 'src/modules/mailbox-connect/__tests__/mailbox-connect.integration.spec.ts', 'src/modules/invitations/__tests__/invitations.integration.spec.ts', 'src/modules/entitlements/__tests__/prisma-entitlement-store.integration.spec.ts', 'src/modules/auth/__tests__/pg-shared-limiter.integration.spec.ts', 'src/modules/outbound/__tests__/worker-loop.integration.spec.ts', 'src/modules/outbound/transport/postgres.integration.spec.ts', 'src/modules/outbound/transport/imap-read.integration.spec.ts', 'src/modules/outbound/transport/imap-tls-fixture.integration.spec.ts'], { cwd: new URL('../../../apps/engine', import.meta.url).pathname, env: { ...process.env, LEADLOOM_INTEGRATION: '1', LEADLOOM_TEST_DATABASE_URL: target.href, LEADLOOM_SMTP_SERVER_MODULE: '/tmp/leadloom-native-mail-fixtures/package.json' }, encoding: 'utf8', timeout: 90000 });
  writeFileSync('/downloads/leadloom-restored-native-integration-tests.txt', test.stdout + '\n' + test.stderr);
  if (test.status !== 0) throw Error('Restored integration suite failed; see attached test log');
  const report = { result: 'PASS', syntheticOnly: true, databaseMajor: 16, tableCount: before.rows.length, rowCount: before.rows.reduce((s, r) => s + r.count, 0), indexCount: before.indexes.length, constraintCount: before.constraints.length, extensions: before.extensions, dataHashesMatch: true, indexDefinitionsMatch: true, constraintMetadataMatch: true, constraintDeparseChanges: deparseChanges, restoredNativeSuitePass: true, actualPrismaRead: true, deletedTableTombstoneRetryRefused:true, tables: before.rows, note: 'Logical pg_dump custom-format + pg_restore into a newly created database. No live-data, PITR, cloud backup, deployment rollback, RTO or RPO claim.' };
  writeFileSync('/downloads/leadloom-native-restore-rehearsal.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, tables: undefined }, null, 2));
} finally {
  if (created) await admin.query('DROP DATABASE ' + ident(targetName));
  await admin.end();
}
