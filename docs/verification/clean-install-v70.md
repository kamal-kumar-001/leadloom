# v70: fresh dependency install, full build and recovery

This checkpoint verifies the complete source outside the inherited dependency tree. It does not enable a live service or claim container/production readiness.

The v69 complete source archive was extracted to an isolated new directory without node_modules or generated builds. Every resolved package URL in its lock pointed to registry.npmjs.org and none carried URL credentials. Initial `npm ci --ignore-scripts --no-audit --no-fund`, explicit Prisma generation and the complete production build passed.

That did not prove the recovery helper was self-contained. Its fresh invocation failed before the safety guard because `pg` was imported but not declared in any workspace manifest. Previous native proof had resolved it from the separate local fixture installation. The missing-import baseline is retained.

## Correction and fresh verification

Added an exact root development dependency on pg8.23.1, matching both the previously native-tested package and the current registry response. Observed package source: https://registry.npmjs.org/pg/-/pg-8.23.1.tgz . The lock adds pg and12 dependencies, removes none and changes no existing locked package except the root manifest metadata. This is a QA prerequisite, not a new provider connection or production feature.

On the isolated source with this correction:

- Standard `npm ci --no-audit --no-fund`, including normal install scripts, passed with479 packages. This final test was not an ignore-scripts install.
- Explicit Prisma client generation passed, matching the engine build prerequisite.
- Generated application/build directories were removed in that isolated copy, then the entire production build passed from the fresh dependency tree.
- The recovery helper now reaches its expected explicit-opt-in refusal instead of a missing import.
- The complete guarded disposable restore passed from the fresh source/dependencies:40 migrations,43 public tables,123 rows, exact data/schema/constraints/index structures, restored scoped routes/watch states, synthetic encrypted key checks and truncated-archive rollback. Temporary rehearsal databases/archives were removed.
- Node release/identity9 passed from the fresh tree.
- Fresh source and the current working source agree on identity `9f0d6229891edf97ee08dbef837d9affcceb8065b3802f6b0923cb92bac419f0`,760 included files. Package manifests/lock and generated identity files are synchronized.

The source change is the missing declared development dependency and lock, plus this note and generated identities. Application feature/auth/scope/migration logic is unchanged from v68. Its782 engine,130 web,14 contract,19 database tests and15 native browser journeys/6 provider configurations remain prior coverage, not a newly rerun full fresh-environment matrix. A full browser/native-mail fixture setup in the clean tree and Docker runtime were not claimed.

The verified newly compiled outputs are in the isolated clean-install directory; the original working directory's old generated dist/.next outputs were not recopied or rebuilt and must not be mistaken for this new identity. Delivered archives exclude all generated outputs and dependencies. A future compiled check should rebuild current source or deliberately use the verified clean tree, not mix their outputs.

No lab/host/data/account change, push, deploy, provider contact, publication, external send or spending. Registry reads and isolated dependency installation/build only. PostgreSQL is stopped and no application children remain. No user-owned blocker established. Production migration, deployment, backups/key recovery, provider budgets/authority and broader product outcomes remain open.
