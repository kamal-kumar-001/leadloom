import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  runDbSchemaPreflight,
  maskDatabaseUrl,
  redactSecretsFromText,
  evaluateDiscoveredSchema,
  REQUIRED_SCHEMA_SPECS,
} from '../src/schema-preflight';

describe('Read-Only Database Schema Preflight', () => {
  describe('Security & Secret Redaction', () => {
    it('masks database passwords and auth tokens in URLs', () => {
      const url = 'postgresql://admin:super_secret_pw_123@prod-db.internal.net:5432/leadloom_production?sslmode=require';
      const masked = maskDatabaseUrl(url);

      expect(masked).not.toContain('super_secret_pw_123');
      expect(masked).toBe('postgresql://admin:••••••@prod-db.internal.net:5432/leadloom_production');
    });

    it('handles unconfigured and invalid URLs safely', () => {
      expect(maskDatabaseUrl(undefined)).toBe('(unconfigured)');
      expect(maskDatabaseUrl('')).toBe('(unconfigured)');
      expect(maskDatabaseUrl('not-a-valid-url')).toBe('postgres://••••••');
    });

    it('redacts credentials from error messages', () => {
      const rawError = 'Connection failed: postgresql://leadloom_app:vault_secret_999@10.0.1.5:5432/leadloom connection refused';
      const sanitized = redactSecretsFromText(rawError);

      expect(sanitized).not.toContain('vault_secret_999');
      expect(sanitized).toContain('postgresql://leadloom_app:••••••@10.0.1.5:5432/leadloom');
    });
  });

  describe('Unconfigured Environment Detection', () => {
    it('reports UNCONFIGURED verdict when no connection string is provided', async () => {
      const origEnv = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        const result = await runDbSchemaPreflight();
        expect(result.verdict).toBe('UNCONFIGURED');
        expect(result.config.configured).toBe(false);
        expect(result.connectivity.status).toBe('unconfigured');
        expect(result.missingTables).toEqual(Object.keys(REQUIRED_SCHEMA_SPECS));
      } finally {
        if (origEnv !== undefined) process.env.DATABASE_URL = origEnv;
      }
    });
  });

  describe('Disposable In-Memory Database Schema Verification (PGlite)', () => {
    let emptyDb: PGlite;
    let migratedDb: PGlite;

    beforeAll(async () => {
      emptyDb = new PGlite({ extensions: { vector } });
      migratedDb = new PGlite({ extensions: { vector } });

      const migrationsDir = path.resolve(__dirname, '../prisma/migrations');

      // Apply initial schema and the core required migrations
      const migrationsToApply = [
        '20261110_init_v2',
        '20261127_validator_metrics',
        '20261128_smoke_page_status',
        '20261201_agent_tokens',
        '20261202_project_scoped_context',
        '20261203_projects_registry',
        '20261205_project_entries',
        '20261110_integrity',
        '20261206_table_import_receipts',
        '20261207_experiment_project',
        '20261208_campaign_project',
        '20261209_research_save_receipts',
        '20261210_project_assets',
        '20261211_campaign_create_receipts',
        '20261212_research_project_ownership',
        '20261213_context_revision','20261214_table_project','20261215_waterfall_runs','20261216_experiment_create_receipts','20261217_table_import_tombstones','20261218_project_growth_watches',
      ];

      for (const m of migrationsToApply) {
        const sqlPath = path.join(migrationsDir, m, 'migration.sql');
        const sql = readFileSync(sqlPath, 'utf8');
        await migratedDb.exec(sql);
      }
    });

    afterAll(async () => {
      await emptyDb?.close();
      await migratedDb?.close();
    });

    it('detects missing tables accurately on an unmigrated database without throwing', async () => {
      const result = await runDbSchemaPreflight({ runner: emptyDb });

      expect(result.verdict).toBe('MISSING_TABLES');
      expect(result.connectivity.status).toBe('connected');
      expect(result.missingTables).toContain('projects');
      expect(result.missingTables).toContain('agent_tokens');
      expect(result.missingTables).toContain('project_contexts');
      expect(result.missingTables).toContain('validation_experiments');
      expect(result.missingTables).toContain('smoke_test_pages');
      expect(result.missingTables).toContain('waitlist_leads');
      expect(result.diagnostic).toContain('Do NOT run blind');
    });

    it('reports READY verdict when all required tables and columns are present', async () => {
      const result = await runDbSchemaPreflight({ runner: migratedDb });

      expect(result.connectivity.status).toBe('connected');
      expect(result.verdict).toBe('READY');
      expect(result.missingTables).toHaveLength(0);
      expect(result.missingColumnsCount).toBe(0);

      // Verify each individual table report
      expect(result.tables.projects.status).toBe('OK');
      expect(result.tables.projects.exists).toBe(true);
      expect(result.tables.projects.missingColumns).toHaveLength(0);

      expect(result.tables.agent_tokens.status).toBe('OK');
      expect(result.tables.agent_tokens.exists).toBe(true);
      expect(result.tables.agent_tokens.missingColumns).toHaveLength(0);

      expect(result.tables.project_contexts.status).toBe('OK');
      expect(result.tables.project_contexts.exists).toBe(true);

      expect(result.tables.validation_experiments.status).toBe('OK');
      expect(result.tables.smoke_test_pages.status).toBe('OK');
      expect(result.tables.waitlist_leads.status).toBe('OK');
    });

    it('reports missing research receipts instead of ready on the old schema',()=>{
      const discovered=Object.entries(REQUIRED_SCHEMA_SPECS).filter(([name])=>name!=='research_save_receipts').flatMap(([table_name,cols])=>cols.map(column_name=>({table_name,column_name})));
      const result=evaluateDiscoveredSchema(discovered,'postgres://localhost/synthetic',1);expect(result.verdict).toBe('MISSING_TABLES');expect(result.missingTables).toContain('research_save_receipts');
    });
    it('reports DEGRADED when campaign ownership migration is missing',()=>{
      const discovered=Object.entries(REQUIRED_SCHEMA_SPECS).flatMap(([table_name,cols])=>cols.filter(c=>!(table_name==='campaigns'&&c==='project_id')).map(column_name=>({table_name,column_name})));
      const result=evaluateDiscoveredSchema(discovered,'postgres://localhost/synthetic',1);
      expect(result.verdict).toBe('DEGRADED');expect(result.tables.campaigns.missingColumns).toEqual(['project_id']);
    });
    it('reports DEGRADED when the additive table ownership column is missing',()=>{const discovered=Object.entries(REQUIRED_SCHEMA_SPECS).flatMap(([table_name,cols])=>cols.filter(c=>!(table_name==='tables'&&c==='project_id')).map(column_name=>({table_name,column_name})));expect(evaluateDiscoveredSchema(discovered,'postgres://localhost/synthetic',1).tables.tables.missingColumns).toEqual(['project_id']);});
    it('reports DEGRADED if the additive experiment project column is not applied',()=>{
      const discovered=Object.entries(REQUIRED_SCHEMA_SPECS).flatMap(([table_name,cols])=>cols.filter(c=>!(table_name==='validation_experiments'&&c==='project_id')).map(column_name=>({table_name,column_name})));
      const result=evaluateDiscoveredSchema(discovered,'postgres://localhost/synthetic',1);
      expect(result.verdict).toBe('DEGRADED');expect(result.tables.validation_experiments.missingColumns).toEqual(['project_id']);
    });
    it('reports DEGRADED verdict if a table exists but is missing required columns', () => {
      const discoveredSample = [
        ...['project_growth_watches','experiment_create_receipts','waterfall_runs','waterfall_run_rows'].flatMap(table_name=>REQUIRED_SCHEMA_SPECS[table_name].map(column_name=>({table_name,column_name}))),
        ...REQUIRED_SCHEMA_SPECS.tables.map((column_name)=>({table_name:'tables',column_name})),
        { table_name: 'projects', column_name: 'id' },
        { table_name: 'projects', column_name: 'workspace_id' },
        // missing slug, name, description, etc.
        ...REQUIRED_SCHEMA_SPECS.research_row_projects.map((c)=>({table_name:'research_row_projects',column_name:c})),
        ...REQUIRED_SCHEMA_SPECS.campaign_create_receipts.map((c) => ({table_name:'campaign_create_receipts',column_name:c})),
        ...REQUIRED_SCHEMA_SPECS.project_assets.map((c) => ({ table_name: 'project_assets', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.project_asset_versions.map((c) => ({ table_name: 'project_asset_versions', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.research_save_receipts.map((c) => ({ table_name: 'research_save_receipts', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.campaigns.map((c) => ({ table_name: 'campaigns', column_name: c })),
        { table_name: 'agent_tokens', column_name: 'id' },
        ...REQUIRED_SCHEMA_SPECS.table_import_receipts.map((c) => ({ table_name: 'table_import_receipts', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.project_entries.map((c) => ({ table_name: 'project_entries', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.agent_tokens.map((c) => ({ table_name: 'agent_tokens', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.project_contexts.map((c) => ({ table_name: 'project_contexts', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.validation_experiments.map((c) => ({ table_name: 'validation_experiments', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.smoke_test_pages.map((c) => ({ table_name: 'smoke_test_pages', column_name: c })),
        ...REQUIRED_SCHEMA_SPECS.waitlist_leads.map((c) => ({ table_name: 'waitlist_leads', column_name: c })),
      ];

      const result = evaluateDiscoveredSchema(discoveredSample, 'postgres://localhost/test', 5);

      expect(result.verdict).toBe('DEGRADED');
      expect(result.missingTables).toHaveLength(0);
      expect(result.tables.projects.status).toBe('MISSING_COLUMNS');
      expect(result.tables.projects.missingColumns).toContain('slug');
      expect(result.tables.projects.missingColumns).toContain('name');
    });
  });
});
