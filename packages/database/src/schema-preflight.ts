import { PrismaClient } from '@prisma/client';

export interface Queryable {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

export const REQUIRED_SCHEMA_SPECS: Record<string, string[]> = {
  project_growth_watches:['id','workspace_id','project_id','experiment_id','requested_by','authorized_by','requested_interval_minutes','interval_minutes','state','revision','next_due_at','last_checked_at','last_digest','last_entry_id','blocked_reason','created_at','updated_at'],
  experiment_create_receipts:['workspace_id','request_id','project_id','payload_hash','experiment_id','created_at'],
  waterfall_runs:['id','workspace_id','table_id','column_id','request_id','requested_by','payload_hash','config_snapshot','created_at'],
  waterfall_run_rows:['id','run_id','workspace_id','row_id','snapshot','state','attempt_id','claimed_at','finished_at','result'],
  tables:["id","workspace_id","project_id","name","row_count","created_at","updated_at"],
  research_row_projects:['row_id','workspace_id','project_id','kind','created_at'],
  campaign_create_receipts: ['workspace_id','request_id','payload_hash','campaign_id','created_at'],
  project_assets: ['id','workspace_id','project_id','kind','current_version','created_at','updated_at'],
  project_asset_versions: ['asset_id','workspace_id','project_id','version','request_id','title','body','created_by_user_id','created_at'],
  research_save_receipts: ['workspace_id','request_id','payload_hash','table_id','row_id','created_at'],
  campaigns: ['id','workspace_id','project_id','name','status','steps','daily_limit_total','schedule_timezone','created_at','updated_at'],
  table_import_receipts: ['project_id','workspace_id','request_id','table_id','payload_hash','imported_count','column_count','created_at'],
  project_entries: ['id','workspace_id','project_id','request_id','kind','title','body','created_by_user_id','created_at'],
  projects: [
    'id',
    'workspace_id',
    'slug',
    'name',
    'description',
    'created_by_user_id',
    'created_at',
    'updated_at',
  ],
  agent_tokens: [
    'id',
    'workspace_id',
    'user_id',
    'name',
    'project_id',
    'token_hash',
    'token_prefix',
    'scopes',
    'expires_at',
    'revoked_at',
    'created_at',
  ],
  project_contexts: [
    'revision',
    'id',
    'workspace_id',
    'project_id',
    'context',
    'metadata',
    'created_by_user_id',
    'created_at',
    'updated_at',
  ],
  validation_experiments: [
    'project_id',
    'id',
    'workspace_id',
    'hypothesis',
    'verdict',
    'verdict_score',
    'actionable_summary',
    'icp_spec',
    'sequence_subject',
    'sequence_body',
    'outreach_sent',
    'replies',
    'positive_replies',
    'created_at',
    'updated_at',
  ],
  smoke_test_pages: [
    'id',
    'experiment_id',
    'slug',
    'title',
    'headline',
    'subheadline',
    'hero_cta_text',
    'survey_questions',
    'custom_domain',
    'visitors',
    'status',
    'created_at',
    'updated_at',
  ],
  waitlist_leads: [
    'id',
    'page_id',
    'email',
    'name',
    'company',
    'survey_responses',
    'referrer',
    'created_at',
  ],
};

export type PreflightVerdict =
  | 'READY'
  | 'DEGRADED'
  | 'MISSING_TABLES'
  | 'UNCONFIGURED'
  | 'AUTH_FAILED'
  | 'UNREACHABLE';

export interface TablePreflightReport {
  tableName: string;
  exists: boolean;
  missingColumns: string[];
  existingColumns: string[];
  status: 'OK' | 'MISSING_TABLE' | 'MISSING_COLUMNS';
}

export interface DbSchemaPreflightResult {
  config: {
    configured: boolean;
    maskedUrl: string;
  };
  connectivity: {
    status: 'connected' | 'unconfigured' | 'auth_failed' | 'unreachable';
    latencyMs?: number;
    error?: string;
  };
  tables: Record<string, TablePreflightReport>;
  verdict: PreflightVerdict;
  missingTables: string[];
  missingColumnsCount: number;
  diagnostic: string;
}

/**
 * Redacts passwords and sensitive auth tokens from database URLs or error strings.
 */
export function maskDatabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '(unconfigured)';
  try {
    const parsed = new URL(rawUrl);
    const auth = parsed.username ? `${parsed.username}:••••••@` : '';
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
  } catch {
    return 'postgres://••••••';
  }
}

export function redactSecretsFromText(text: string): string {
  return text.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, '$1••••••$2');
}

/**
 * Evaluates the discovered schema against required specifications.
 * Pure logic function for zero-mutation analysis.
 */
export function evaluateDiscoveredSchema(
  discovered: Array<{ table_name: string; column_name: string }>,
  maskedUrl: string,
  latencyMs: number
): DbSchemaPreflightResult {
  const discoveredMap = new Map<string, Set<string>>();

  for (const row of discovered) {
    const t = row.table_name.toLowerCase();
    const c = row.column_name.toLowerCase();
    if (!discoveredMap.has(t)) {
      discoveredMap.set(t, new Set());
    }
    discoveredMap.get(t)!.add(c);
  }

  const tables: Record<string, TablePreflightReport> = {};
  const missingTables: string[] = [];
  let missingColumnsCount = 0;

  for (const [tableName, requiredCols] of Object.entries(REQUIRED_SCHEMA_SPECS)) {
    const existingColsSet = discoveredMap.get(tableName.toLowerCase());
    if (!existingColsSet) {
      missingTables.push(tableName);
      tables[tableName] = {
        tableName,
        exists: false,
        missingColumns: [...requiredCols],
        existingColumns: [],
        status: 'MISSING_TABLE',
      };
      missingColumnsCount += requiredCols.length;
    } else {
      const existingColumns = [...existingColsSet];
      const missingColumns = requiredCols.filter((col) => !existingColsSet.has(col.toLowerCase()));
      missingColumnsCount += missingColumns.length;

      tables[tableName] = {
        tableName,
        exists: true,
        missingColumns,
        existingColumns,
        status: missingColumns.length === 0 ? 'OK' : 'MISSING_COLUMNS',
      };
    }
  }

  let verdict: PreflightVerdict = 'READY';
  let diagnostic = 'All required project, token, context, and validator tables and columns are present.';

  if (missingTables.length > 0) {
    verdict = 'MISSING_TABLES';
    diagnostic = `Database is reachable, but missing ${missingTables.length} required table(s): ${missingTables.join(
      ', '
    )}. Do NOT run blind 'prisma migrate deploy' due to historical migration ordering dependencies.`;
  } else if (missingColumnsCount > 0) {
    verdict = 'DEGRADED';
    diagnostic = `Database tables exist, but ${missingColumnsCount} required column(s) are missing across schema.`;
  }

  return {
    config: {
      configured: true,
      maskedUrl,
    },
    connectivity: {
      status: 'connected',
      latencyMs,
    },
    tables,
    verdict,
    missingTables,
    missingColumnsCount,
    diagnostic,
  };
}

/**
 * Executes a strictly read-only schema preflight check against a target database.
 * Never executes mutations or alters state. Never leaks credentials.
 */
export async function runDbSchemaPreflight(options?: {
  databaseUrl?: string;
  runner?: Queryable;
}): Promise<DbSchemaPreflightResult> {
  const dbUrl = options?.databaseUrl || process.env.DATABASE_URL;

  // 1. If custom runner passed (e.g. in-memory PGlite for tests), execute read query directly
  if (options?.runner) {
    const start = Date.now();
    try {
      const res = await options.runner.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'public' OR table_schema = current_schema()`
      );
      const latencyMs = Date.now() - start;
      return evaluateDiscoveredSchema(res.rows, maskDatabaseUrl(dbUrl), latencyMs);
    } catch (err: unknown) {
      const msg = redactSecretsFromText(err instanceof Error ? err.message : String(err));
      return {
        config: { configured: Boolean(dbUrl), maskedUrl: maskDatabaseUrl(dbUrl) },
        connectivity: { status: 'unreachable', error: msg },
        tables: {},
        verdict: 'UNREACHABLE',
        missingTables: Object.keys(REQUIRED_SCHEMA_SPECS),
        missingColumnsCount: 0,
        diagnostic: `Database query failed: ${msg}`,
      };
    }
  }

  // 2. Unconfigured check
  if (!dbUrl) {
    return {
      config: { configured: false, maskedUrl: '(unconfigured)' },
      connectivity: { status: 'unconfigured' },
      tables: {},
      verdict: 'UNCONFIGURED',
      missingTables: Object.keys(REQUIRED_SCHEMA_SPECS),
      missingColumnsCount: 0,
      diagnostic: 'DATABASE_URL is not configured in environment.',
    };
  }

  // 3. Connect via Prisma client for read-only inspection
  const maskedUrl = maskDatabaseUrl(dbUrl);
  const prismaClient = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['error'],
  });

  const start = Date.now();
  try {
    // Read-only query against information_schema
    const rows = await prismaClient.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
      `SELECT table_name, column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public' OR table_schema = current_schema()`
    );
    const latencyMs = Date.now() - start;
    return evaluateDiscoveredSchema(rows, maskedUrl, latencyMs);
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const sanitizedMsg = redactSecretsFromText(rawMsg);
    const isAuthFailed = /authentication failed|password authentication|access denied/i.test(sanitizedMsg);

    return {
      config: { configured: true, maskedUrl },
      connectivity: {
        status: isAuthFailed ? 'auth_failed' : 'unreachable',
        error: sanitizedMsg,
      },
      tables: {},
      verdict: isAuthFailed ? 'AUTH_FAILED' : 'UNREACHABLE',
      missingTables: Object.keys(REQUIRED_SCHEMA_SPECS),
      missingColumnsCount: 0,
      diagnostic: `Database connection failed (${isAuthFailed ? 'Authentication error' : 'Unreachable'}): ${sanitizedMsg}`,
    };
  } finally {
    await prismaClient.$disconnect().catch(() => {});
  }
}
