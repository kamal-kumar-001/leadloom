# Migration history compatibility

Recorded history on the lab product DB (read-only check 2026-11-10 6:42 PM IST; names, checksums, status only):

| migration_name | checksum (sha256 of migration.sql) | finished |
|---|---|---|
| 20261110_init_v2 | ed902c56...50865fb5 | yes |
| 20261110_integrity | 19fb153a...e746dbd5c | yes |
| 20261110_inbound_sync | e30e9c39...a0510f6 | yes |

Source keeps those three names. `20261110_init_v2` and `20261110_integrity` are byte-identical to what is recorded.

## Unavoidable change
`20261110_inbound_sync` sorts before `20261110_init_v2`, so on an empty database it ran before `mailboxes` existed and failed. Prisma applies migrations in directory-name order and the recorded names cannot change, so a byte-identical file cannot work on empty databases. The file is now guarded (does nothing if the base tables are missing) and `20261111_inbound_sync_ensure` creates the same objects idempotently afterward.

Effect on the existing DB: the recorded checksum for `20261110_inbound_sync` (e30e9c39...) no longer matches the file. `prisma migrate deploy` tolerated this in an isolated fixture built with the identical recorded history and applied only `20261111_inbound_sync_ensure`. `prisma migrate dev` would flag the edited file as drift and must not be run against that DB. Do not rewrite `_prisma_migrations` rows unless Kamal approves it.

Verification: Postgres 16.2 + pgvector throwaway fixtures: empty DB, init+integrity only, all three applied. All reach "Database schema is up to date".
