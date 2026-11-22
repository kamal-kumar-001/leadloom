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
# Fail closed before baseline SQL. Missing migration history does not prove an
# empty database, and connection/auth errors must never count as emptiness.
SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
if ! npx prisma db execute --file "$SCRIPT_DIR/assert-fresh-database.sql" --schema "$SCHEMA"; then
  echo "refusing: target was not verified empty; no baseline SQL was run. Review the target and use the existing-install migration procedure only for an identified Leadloom database." >&2
  exit 2
fi
for m in 20261110_init_v2 20261110_integrity; do
  npx prisma db execute --file "$MIG/$m/migration.sql" --schema "$SCHEMA"
  npx prisma migrate resolve --applied "$m" --schema "$SCHEMA"
done
npx prisma migrate deploy --schema "$SCHEMA"
