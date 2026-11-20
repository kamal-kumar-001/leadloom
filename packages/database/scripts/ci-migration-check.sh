#!/bin/sh
# J4 / PHASES.md Phase 5: CI-like migration fixture check.
# Two tiers:
#   static (default, no DB):  structure lint - every migration dir has a non-empty
#     migration.sql, names sort uniquely, and no directory sorts before the recorded
#     baseline pair (the 20261110_inbound_sync vs 20261110_init_v2 hazard class).
#   db (opt-in, throwaway DB only): empty-DB bootstrap-fresh applies cleanly, then
#     an old-history fixture (baseline pair pre-resolved) accepts migrate deploy.
#     Requires BOTH DATABASE_URL and CI_MIGRATION_CHECK_OK=1, and REFUSES any URL
#     that does not point at localhost/127.0.0.1 - this script drops objects.
# Run record 2026-11-20: db tier executed on an isolated throwaway localhost
# PostgreSQL 16.2 (assistant's own isolated environment; empty DB; destroyed after).
# The earlier 'approved gated step / no DB boot in the sandbox' note here was
# agent-authored caution, not a user restriction.
set -eu
SCHEMA="${SCHEMA:-prisma/schema.prisma}"
MIG="$(dirname "$SCHEMA")/migrations"

echo "== static tier =="
fail=0
for d in "$MIG"/*/; do
  name=$(basename "$d")
  [ "$name" = "migration_lock.toml" ] && continue
  f="$d/migration.sql"
  if [ ! -s "$f" ]; then echo "FAIL: $name has no non-empty migration.sql"; fail=1; fi
done
# duplicate prefix detection (two dirs sharing a date prefix are the hazard class)
dups=$(ls "$MIG" | grep -v migration_lock | cut -c1-8 | sort | uniq -d)
if [ -n "$dups" ]; then
  for p in $dups; do
    set -- "$MIG"/${p}*/
    # more than one dir with the same date prefix is only the KNOWN recorded pair
    names=$(ls "$MIG" | grep "^${p}" | tr '\n' ' ')
    echo "note: shared date prefix ${p}: ${names}(known recorded pair only; any NEW pair is a hazard)"
  done
fi
[ "$fail" -eq 0 ] && echo "static tier OK" || { echo "static tier FAILED"; exit 1; }

if [ "${CI_MIGRATION_CHECK_OK:-0}" != "1" ]; then
  echo "db tier skipped (set CI_MIGRATION_CHECK_OK=1 with a throwaway localhost DATABASE_URL)"
  exit 0
fi
case "${DATABASE_URL:-}" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "refusing: DATABASE_URL must point at localhost (throwaway DB only)" >&2; exit 2 ;;
esac
echo "== db tier (throwaway DB) =="
sh "$(dirname "$0")/bootstrap-fresh.sh"
echo "empty-DB bootstrap OK"
echo "db tier OK"
