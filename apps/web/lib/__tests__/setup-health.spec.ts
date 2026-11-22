import { describe, it, expect } from 'vitest';
import {
  SetupHealthResponseSchema,
  SetupHealthDatabaseSchema,
  SetupHealthConfigSchema,
  SetupHealthProvidersSchema,
  type SetupHealthResponse,
} from '@leadloom/contracts';
import { REQUIRED_SCHEMA_SPECS, maskDatabaseUrl, redactSecretsFromText } from '@leadloom/database';

describe('Actionable Setup Health Telemetry & Preflight Invariants', () => {
  describe('Zero-Secret Exposure Invariant', () => {
    it('strictly redacts credentials and auth tokens in database descriptors', () => {
      const rawConn = 'postgresql://leadloom_prod:super_secret_pg_pass_999@postgres-master.internal:5432/leadloom_db';
      const masked = maskDatabaseUrl(rawConn);

      expect(masked).not.toContain('super_secret_pg_pass_999');
      expect(masked).toBe('postgresql://leadloom_prod:••••••@postgres-master.internal:5432/leadloom_db');
    });

    it('redacts database credentials in error messages and diagnostics', () => {
      const errorMsg = 'FATAL: password authentication failed for user "app" at postgresql://app:TopSecret123!@10.0.0.1:5432/leadloom';
      const sanitized = redactSecretsFromText(errorMsg);

      expect(sanitized).not.toContain('TopSecret123!');
      expect(sanitized).toContain('postgresql://app:••••••@10.0.0.1:5432/leadloom');
    });

    it('validates that SetupHealthResponse contains only non-sensitive statuses and zero database connection strings', () => {
      const sampleHealth: SetupHealthResponse = {
        status: 'ok',
        database: {
          status: 'connected',
          verdict: 'READY',
          verificationMode: 'column-presence-only',
          missingTables: [],
          missingColumnsCount: 0,
          diagnostic: 'All required project, token, context, and validator tables and columns are present (verified by column-presence-only; runtime column types unverified).',
        },
        config: {
          publicApiUrl: 'https://leadloom.dmpilot.org/api/agent',
          publicApiConfigured: true,
          authSecretConfigured: true,
          bridgeSecretConfigured: true,
        },
        providers: {
          websiteFetcher: 'active',
          outboundDispatch: 'dry-run-safe',
          vaultEncryption: 'active-aes-256-gcm',
          mutationsEnabled: true,
        },
        checkedAt: new Date().toISOString(),
      };

      const parsed = SetupHealthResponseSchema.safeParse(sampleHealth);
      expect(parsed.success).toBe(true);

      const serialized = JSON.stringify(sampleHealth);
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('postgresql:');
      expect(serialized).not.toContain('token_hash');
      expect(serialized).not.toContain('sk_live');
      expect(serialized).not.toContain('lld_agt');
    });
  });

  describe('Core Schema Exact Columns Parity', () => {
    it('verifies all 6 core tables are specified with exact migration DDL columns', () => {
      const requiredTables = Object.keys(REQUIRED_SCHEMA_SPECS);
      expect(requiredTables).toContain('projects');
      expect(requiredTables).toContain('agent_tokens');
      expect(requiredTables).toContain('project_contexts');
      expect(requiredTables).toContain('validation_experiments');
      expect(requiredTables).toContain('smoke_test_pages');
      expect(requiredTables).toContain('waitlist_leads');
    });

    it('ensures validation_experiments includes hypothesis decomposition columns from 20261110_init_v2', () => {
      const cols = REQUIRED_SCHEMA_SPECS.validation_experiments;
      expect(cols).toContain('icp_spec');
      expect(cols).toContain('sequence_subject');
      expect(cols).toContain('sequence_body');
      expect(cols).toContain('outreach_sent');
      expect(cols).toContain('replies');
      expect(cols).toContain('positive_replies');
      expect(cols).toContain('updated_at');
    });

    it('ensures smoke_test_pages includes status and custom_domain from additive migrations', () => {
      const cols = REQUIRED_SCHEMA_SPECS.smoke_test_pages;
      expect(cols).toContain('hero_cta_text');
      expect(cols).toContain('survey_questions');
      expect(cols).toContain('custom_domain');
      expect(cols).toContain('status');
      expect(cols).toContain('visitors');
      expect(cols).toContain('updated_at');
    });
  });

  describe('Degraded & Missing Dependency Handling', () => {
    it('correctly models DEGRADED status when missing optional or provider dependencies', () => {
      const degradedHealth: SetupHealthResponse = {
        status: 'degraded',
        database: {
          status: 'connected',
          verdict: 'MISSING_TABLES',
          verificationMode: 'column-presence-only',
          missingTables: ['smoke_test_pages', 'waitlist_leads'],
          missingColumnsCount: 21,
          diagnostic: 'Database is reachable, but missing 2 required table(s). Do NOT run blind migrate deploy.',
        },
        config: {
          publicApiUrl: 'https://leadloom.dmpilot.org/api/agent',
          publicApiConfigured: false,
          authSecretConfigured: true,
          bridgeSecretConfigured: false,
        },
        providers: {
          websiteFetcher: 'pasted-text-only',
          outboundDispatch: 'dry-run-safe',
          vaultEncryption: 'unconfigured',
          mutationsEnabled: false,
        },
        checkedAt: new Date().toISOString(),
      };

      const parsed = SetupHealthResponseSchema.safeParse(degradedHealth);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe('degraded');
        expect(parsed.data.database.verdict).toBe('MISSING_TABLES');
        expect(parsed.data.database.missingTables).toHaveLength(2);
      }
    });

    it('correctly models UNREACHABLE / ERROR status when engine or DB is offline', () => {
      const errorHealth: SetupHealthResponse = {
        status: 'error',
        database: {
          status: 'unreachable',
          verdict: 'UNREACHABLE',
          verificationMode: 'column-presence-only',
          missingTables: ['projects', 'agent_tokens', 'project_contexts', 'validation_experiments', 'smoke_test_pages', 'waitlist_leads'],
          missingColumnsCount: 0,
          diagnostic: 'DATABASE_URL is not configured in environment.',
        },
        config: {
          publicApiUrl: 'https://leadloom.dmpilot.org/api/agent',
          publicApiConfigured: false,
          authSecretConfigured: false,
          bridgeSecretConfigured: false,
        },
        providers: {
          websiteFetcher: 'disabled',
          outboundDispatch: 'unmounted',
          vaultEncryption: 'unconfigured',
          mutationsEnabled: false,
        },
        checkedAt: new Date().toISOString(),
      };

      const parsed = SetupHealthResponseSchema.safeParse(errorHealth);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe('error');
        expect(parsed.data.database.status).toBe('unreachable');
      }
    });
  });
});
