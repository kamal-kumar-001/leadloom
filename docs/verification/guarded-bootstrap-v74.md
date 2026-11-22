# Guarded fresh bootstrap, v74

The v73 fresh-bootstrap helper inferred emptiness from missing Prisma migration history. A disposable database with an unrelated populated table and no migration history was accepted and received the Leadloom schema. No production or existing user database was involved in this reproduction.

## Correction

`packages/database/scripts/assert-fresh-database.sql` runs a read-only transaction with a five-second statement timeout and a system-only search path. It refuses non-system schemas other than `public` and `information_schema`, and existing user tables, partitioned tables, views, materialized views, foreign tables, sequences and composite relations. Migration history is therefore also refused. The shell helper exits before baseline SQL if this check, authentication or connection fails. Existing baseline, migration-history resolution and versioned deployment order are unchanged after a successful preflight.

A preinstalled pgvector extension alone is supported. Existing identified Leadloom databases still require reviewed versioned migrations, not this fresh-install helper.

## Focused evidence

The native PostgreSQL 16 harness creates uniquely named, local disposable databases and removes the databases it created in a final cleanup. It tests five refusals: public sentinel data, private-schema sentinel data, an empty non-public schema, a view plus sequence, and migration history. Object, schema, extension and sentinel snapshots must remain unchanged on refusal. Two positive cases, empty and pgvector-only, must reach all 40 migrations.

The shell contract tests inject failed checks and first-baseline failures, verify six-command ordering on success, and verify that missing DATABASE_URL invokes no database command. They complement native execution rather than pretending mocks prove database behavior.

The native bootstrap fixture also resolves its database package from its own source location, not a hardcoded earlier checkout. Dependencies and migration SQL are unchanged.

## Limits

This preflight is not an inventory of every function, type, role or cluster object. It is not an atomic exclusion lock against another schema writer between the preflight and baseline. Operators must independently verify the intended target and reserve the fresh install exclusively. It is not an existing-database repair, automatic rollback or recovery command. A later migration failure can still require manual recovery of that new installation.

No live host, container, provider, send or production-database execution is established by these local checks. See the accompanying v74 checkpoint for final command results and retained earlier application coverage.
