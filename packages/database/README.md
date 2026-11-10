# Database checkpoint

Prisma 5 schema and client for the registry in PROJECT_STATE. Initial SQL is
generated from schema.prisma; a separate migration adds checks Prisma cannot
express. There are 15 registry tables plus campaign_mailboxes, outbound_jobs and two daily-usage tables. The mailbox join is required to persist
CreateCampaignRequest.mailboxPoolIds. Cell table membership and campaign-table /
mailbox-pool tenant boundaries use composite foreign keys.

This is not full tenant authorization or row-level security. All queries must
scope by the workspace from authenticated server context. Credential Prisma persistence and signed-session route checks are wired; login/identity issuance, complete RBAC and native-database integration tests remain. Enrichment cache payloads must contain
only provider-safe domain-level data, never tenant-private or credential data.

Commands from repository root after dependency installation:

- `npm run prisma:validate --workspace @leadloom/database` (requires DATABASE_URL;
  no connection is made by validation)
- `npm run prisma:generate --workspace @leadloom/database`
- `npm run build --workspace @leadloom/database`
- `npm test --workspace @leadloom/database`

Tests apply both migration files to isolated PGlite PostgreSQL with pgvector and
synthetic fixtures. They test real SQL constraints, but not Prisma connections,
native PostgreSQL 16, concurrency or an existing production schema. Production
migration and backup/restore review remain required. Do not use db push as a
substitute for reviewing and applying versioned migrations.

No database credentials or master keys are included. The test URL used for schema
validation is a non-working synthetic identifier only.
