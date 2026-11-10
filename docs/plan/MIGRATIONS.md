# Migration history compatibility

## Existing installs (lab product DB)
Read-only check on 2026-11-10 6:42 PM IST (names, checksums, status only): `20261110_init_v2`, `20261110_integrity`, `20261110_inbound_sync` are applied, finished, not rolled back. Source now keeps all three directories byte-identical to those recorded checksums (verified with sha256: ed902c56..., 19fb153a..., e30e9c39...). No migration was added or edited. `prisma migrate deploy` on that history has nothing to apply (verified on a replica fixture built from the same checksums).

## Fresh installs (empty database)
`prisma migrate deploy` alone FAILS on an empty DB: `20261110_inbound_sync` sorts before `20261110_init_v2` and needs `mailboxes` (Postgres 42P01). Supported route: `packages/database/scripts/bootstrap-fresh.sh`. It refuses unless `_prisma_migrations` is absent, applies init_v2 and integrity SQL with `prisma db execute`, records them with `prisma migrate resolve --applied` (same checksums), then runs `prisma migrate deploy` for inbound_sync. Result history is identical to the lab's.

Known caveats:
- `update.sh` runs plain `migrate deploy`, so a fresh install through update.sh alone fails loudly until the bootstrap script is run first. Wiring it into update.sh is a separate change and has not been made.
- This replaces the earlier approach (a guarded inbound_sync plus a 20261111 ensure migration, commit a5f2d5e on main), which changed the applied checksum. That drift is gone in this source.

Verification (Postgres 16.2 + pgvector throwaway fixtures, local, no lab data): plain deploy on empty (fails, control); bootstrap on empty (3 rows, checksums equal the files, status up to date); second bootstrap refused; replica of lab history then deploy (no-op, status up to date).
