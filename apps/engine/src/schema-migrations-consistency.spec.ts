import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Guard against the 20261127 drift class: a migration adding columns that are
// missing from schema.prisma (Prisma client then silently reads/writes nothing
// for them), or schema.prisma fields with no migration ever creating them.
// The parser is name-only (no type mapping) and covers the DDL shapes this
// repo uses: CREATE TABLE, ALTER TABLE ... ADD COLUMN.

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../packages/database/prisma/migrations');
const SCHEMA_PATH = path.resolve(__dirname, '../../../packages/database/prisma/schema.prisma');

const KEYWORDS = new Set(['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'EXCLUDE', 'LIKE']);
// Prisma scalar types (this schema has no enums; add enum names here if introduced).
const SCALARS = new Set(['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes']);

type TableMap = Map<string, Set<string>>;

function applyMigrations(): TableMap {
  const tables: TableMap = new Map();
  const dirs = readdirSync(MIGRATIONS_DIR)
    .filter((d) => /^\d{8}_/.test(d))
    .sort();
  for (const dir of dirs) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
    // Strip -- line comments so commented-out DDL never registers.
    const clean = sql.replace(/--[^\n]*/g, '');

    for (const m of clean.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?(\w+)"?\s*\(([\s\S]*?)\n\);/g)) {
      const [, table, body] = m;
      const cols = new Set<string>();
      for (const line of body.split('\n')) {
        const colMatch = line.match(/^\s*"?(\w+)"?\s+[A-Za-z]/);
        if (!colMatch) continue;
        if (KEYWORDS.has(colMatch[1].toUpperCase())) continue;
        cols.add(colMatch[1]);
      }
      tables.set(table, new Set([...(tables.get(table) ?? []), ...cols]));
    }

    for (const m of clean.matchAll(/ALTER TABLE\s+"?(\w+)"?\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"?(\w+)"?/g)) {
      const [, table, col] = m;
      if (!tables.has(table)) tables.set(table, new Set());
      tables.get(table)!.add(col);
    }

    for (const m of clean.matchAll(/ALTER TABLE\s+"?(\w+)"?\s+DROP COLUMN(?:\s+IF EXISTS)?\s+"?(\w+)"?/g)) {
      tables.get(m[1])?.delete(m[2]);
    }

    for (const m of clean.matchAll(/DROP TABLE(?:\s+IF EXISTS)?\s+"?(\w+)"?/g)) {
      tables.delete(m[1]);
    }
  }
  return tables;
}

function parseSchema(): TableMap {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const tables: TableMap = new Map();
  for (const m of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const [, modelName, body] = m;
    const mapMatch = body.match(/@@map\("(\w+)"\)/);
    if (!mapMatch) {
      throw new Error(`model ${modelName} has no @@map; every table-backed model must name its table`);
    }
    const cols = new Set<string>();
    for (const line of body.split('\n')) {
      const f = line.match(/^\s*(\w+)\s+(\w+)(\?|\[\])?/);
      if (!f || line.trimStart().startsWith('@@') || line.trimStart().startsWith('//')) continue;
      const [, fieldName, typeName] = f;
      // Only scalar-typed fields are real columns; anything else (relations)
      // contributes no column of its own. Unsupported(...) is also a column.
      if (!SCALARS.has(typeName) && !line.includes('Unsupported(')) continue;
      const colMap = line.match(/@map\("(\w+)"\)/);
      cols.add(colMap ? colMap[1] : fieldName);
    }
    tables.set(mapMatch[1], cols);
  }
  return tables;
}

describe('schema.prisma <-> migrations consistency', () => {
  it('every model field column exists in the applied migrations', () => {
    const migrated = applyMigrations();
    const modeled = parseSchema();
    const missing: string[] = [];
    for (const [table, cols] of modeled) {
      if (!migrated.has(table)) {
        missing.push(`table "${table}" is modeled in schema.prisma but no migration creates it`);
        continue;
      }
      for (const col of cols) {
        if (!migrated.get(table)!.has(col)) missing.push(`${table}.${col}`);
      }
    }
    expect(missing, `schema.prisma columns with no migration:\n${missing.join('\n')}`).toEqual([]);
  });

  it('every migrated column is modeled in schema.prisma (no silent drift)', () => {
    const migrated = applyMigrations();
    const modeled = parseSchema();
    const extra: string[] = [];
    // Columns/tables managed exclusively through raw SQL (never the Prisma
    // client) are allowed but must be acknowledged here so new drift is a
    // deliberate choice, not a silent omission like 20261127.
    const RAW_ONLY_TABLES = new Set([
      'audit_log', // append-only audit writer, raw SQL
      'usage_counters', // entitlement counters, raw SQL
      'workspace_plans', // entitlement store, raw SQL
      'inbound_replies', // reply ingest, raw SQL
      'workspace_invitations', // prisma-invitation-store uses raw SQL for the table
      'campaign_recipients', // campaign-recipients.repository, raw SQL
    ]);
    const RAW_ONLY_COLUMNS = new Set([
      // Atomic dispatch + approval integrity run through raw SQL in
      // atomic-dispatch.repository.ts (locking updates the Prisma client
      // cannot express); modeling them invites bypassing those invariants.
      'outbound_jobs.approval_content_hash',
      'outbound_jobs.approval_snapshot',
      'outbound_jobs.approved_at',
      'outbound_jobs.recipient_id',
      'outbound_jobs.recipient_fields',
      'outbound_jobs.sender_mailbox_id',
    ]);
    for (const [table, cols] of migrated) {
      if (!modeled.has(table)) {
        if (!RAW_ONLY_TABLES.has(table)) {
          extra.push(`table "${table}" exists in migrations but has no model in schema.prisma`);
        }
        continue;
      }
      for (const col of cols) {
        if (!modeled.get(table)!.has(col) && !RAW_ONLY_COLUMNS.has(`${table}.${col}`)) {
          extra.push(`${table}.${col}`);
        }
      }
    }
    expect(
      extra,
      `migration columns missing from schema.prisma (Prisma client silently ignores them):\n${extra.join('\n')}`,
    ).toEqual([]);
  });
});
