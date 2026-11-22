#!/usr/bin/env node
/**
 * Read-Only DB Schema Preflight Checker.
 * Inspects required project, token, context, and validator tables and columns.
 * NEVER executes mutations. NEVER prints secrets or passwords.
 *
 * Usage:
 *   node scripts/ops/db-schema-preflight.mjs
 *   node scripts/ops/db-schema-preflight.mjs --json
 */

import { runDbSchemaPreflight } from '../../packages/database/dist/schema-preflight.js';

async function main() {
  const jsonOutput = process.argv.includes('--json');
  const result = await runDbSchemaPreflight();

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.verdict === 'READY' ? 0 : 1);
  }

  console.log('════════════════════════════════════════════════════════════════');
  console.log('   LeadLoom Database Schema Preflight (Read-Only)              ');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Target Database:  ${result.config.maskedUrl}`);
  console.log(`Connectivity:     ${result.connectivity.status.toUpperCase()}${result.connectivity.latencyMs ? ` (${result.connectivity.latencyMs}ms)` : ''}`);

  if (result.connectivity.error) {
    console.log(`Connection Error: ${result.connectivity.error}`);
  }

  console.log('────────────────────────────────────────────────────────────────');
  console.log('Required Tables & Columns Status:');
  console.log('────────────────────────────────────────────────────────────────');

  for (const [table, report] of Object.entries(result.tables)) {
    if (!report.exists) {
      console.log(` ❌ ${table.padEnd(24)} MISSING TABLE`);
    } else if (report.missingColumns.length > 0) {
      console.log(` ⚠️  ${table.padEnd(24)} MISSING COLUMNS: ${report.missingColumns.join(', ')}`);
    } else {
      console.log(` ✅ ${table.padEnd(24)} OK (${report.existingColumns.length} columns)`);
    }
  }

  console.log('────────────────────────────────────────────────────────────────');
  console.log(`Preflight Verdict: ${result.verdict}`);
  console.log(`Diagnostic:        ${result.diagnostic}`);
  console.log('════════════════════════════════════════════════════════════════');

  process.exit(result.verdict === 'READY' ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal preflight error:', err.message || err);
  process.exit(1);
});
