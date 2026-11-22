# Local synthetic backup/restore rehearsal

`scripts/ops/backup-restore.synthetic.mts` is a disposable recovery test, not a production backup command. It creates fresh source, restored and corruption-test databases, bootstraps the real migration chain, writes synthetic fixtures through actual application services, uses PostgreSQL custom-format dump/restore, checks the recovered state, then removes those databases and temporary archives.

Run from the repository root with the existing dependencies built. Supply `LEADLOOM_SYNTHETIC_RESTORE=1`, `LEADLOOM_SYNTHETIC_ADMIN_URL` for a local disposable PostgreSQL16 server, and `LEADLOOM_SYNTHETIC_PG_BIN` pointing to its pg_dump/pg_restore binaries. Invoke with `node_modules/.bin/tsx scripts/ops/backup-restore.synthetic.mts`.

The admin connection must be localhost/loopback, without a password-bearing URL. The only allowed query parameter is `host`, for a socket under `/tmp/leadloom-`. Missing opt-in, a remote URL, query-based redirection and password-bearing URLs are refused before database creation. The test never dumps the existing database named by that connection. It only reads/writes the fresh, randomly named `leadloom_restore_` databases it created. Use a disposable local PostgreSQL account with permission to create/drop databases. Do not point it at a production server.

## What is checked

- Ordered per-table JSON data hashes and row counts across every public table, including migration history.
- Column types, defaults and nullability; named constraints; index structural metadata, including method, uniqueness, primary/valid flags and column positions/counts. The index check is not an independent semantic equivalence test of every expression or partial predicate.
- Check constraints are reparsed by PostgreSQL on isolated temporary tables before comparison. Dump/restore can change equivalent grouping and array-cast syntax. This avoids treating those parser-normalization changes as lost constraints; it does not omit the constraints from comparison.
- Actual service reads of guarded project context, current and historical drafts, work records, project research and campaign receipts, active and revoked tokens, saved project inventory and held outbound status.
- A synthetic encrypted credential decrypts only with the retained matching test key and workspace. A wrong test key and wrong workspace fail. A database dump does not replace separately secured application keys.
- The textual data stream contains neither the synthetic provider plaintext nor plaintext issued bearer tokens.
- A truncated archive is rejected, and single-transaction restore leaves the empty corruption-test target without public tables.

No application server, worker, provider call, recipient delivery, website publication or production migration is started. Only an aggregate report is printed. Temporary dump files, generated fixture tokens, and test data are not packaged into the source candidate.

## What is not proved

This rehearsal is not evidence that production data is backed up or restorable. It does not test production server roles/configuration, separate encryption-key recovery, off-site encrypted storage, retention, scheduled backups, recovery time under production volume, provider credentials or safe production replay. Those require a separately authorized production recovery plan and evidence.
