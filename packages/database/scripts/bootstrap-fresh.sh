#!/bin/sh
# Fresh-install baseline for an EMPTY database only.
# Why: migration dir 20261110_inbound_sync (already applied, checksum recorded on
# existing installs) sorts before 20261110_init_v2, so `prisma migrate deploy` alone
# fails on an empty DB. Existing installs never need this script.
# Usage: DATABASE_URL=... sh scripts/bootstrap-fresh.sh   (run from packages/database or pass SCHEMA)
set -eu
SCHEMA="${SCHEMA:-prisma/schema.prisma}"
MIG="$(dirname "$SCHEMA")/migrations"
: "${DATABASE_URL:?DATABASE_URL required}"
# Refuse unless the database has no migration history at all.
if echo "select 1 from _prisma_migrations limit 1" | npx prisma db execute --stdin --schema "$SCHEMA" >/dev/null 2>&1; then
  echo "refusing: _prisma_migrations already exists; use 'prisma migrate deploy'" >&2; exit 2
fi
for m in 20261110_init_v2 20261110_integrity; do
  npx prisma db execute --file "$MIG/$m/migration.sql" --schema "$SCHEMA"
  npx prisma migrate resolve --applied "$m" --schema "$SCHEMA"
done
npx prisma migrate deploy --schema "$SCHEMA"
