# Release checks and explicit execution

`bash update.sh` now prints a plan only. It does not pull code, contact Docker or the network, read environment values, change files, migrate or deploy. `--help` describes the options. A code build/test candidate is not permission to run a production update.

## Before an independently approved release

- Review the exact source/revision and pending migrations. The script never pulls, checks out or pushes Git. The operator selects the release source separately.
- Verify an actual recoverable backup and separately retained application keys/configuration. Supply its reference with `--backup-reference`. The reference is an operator assertion, not evidence checked by the script. The disposable synthetic rehearsal is not a production backup.
- Provide the intended `.env` locally. It is never sourced as shell code or rewritten. Docker Compose resolves it. The script keeps the resolved configuration and command output in process memory and never prints credentials, raw command diagnostics, logs or environment values.
- Confirm feature/authentication/provider/send posture separately. Defaults expect an unmounted send worker and sending disabled. `--expect-worker mounted|unmounted` and `--expect-sending true|false` assert expected existing configuration; they do not enable or change it. A mismatch stops before image building. Compose must actually pass intended variables to the container. This script does not add absent feature flags.
- Password auth requires configured transactional mail settings; this is not proof of email delivery. An enabled identity bridge requires matching web/engine bridge configuration. Actual OAuth, email codes and account/session journeys still need release-specific evidence.
- Docker Compose v2 supporting `config --format json` and `up --wait` is required. Application ports must have one explicit loopback mapping. APP_BASE_URL must be a root HTTPS origin without credentials, query or fragment. The public route must be accessible without an interactive challenge or redirect. Failures remain failures; do not weaken the check to hide them.

Only once that release and its effects are approved, execute:

```
bash update.sh --execute --backup-reference '<independently verified backup reference>'
```

No live release is performed by the source verification tests.

## Order and failure semantics

1. Acquire `.leadloom-release.lock` exclusively. A second run is refused. Normal exit/failure releases the owned lock; an interrupted/killed process may leave it behind. Inspect the active process, migration and container state before manually removing a stale lock. Never blindly remove a live lock.
2. Resolve and validate Compose configuration without printing its values.
3. Build api/web images without replacing running application services.
4. Start database/cache services and wait for their configured healthchecks. Starting dependencies is a real effect, even if a later step fails.
5. Apply migrations with the new api image, verify migration status, then run the required-column schema preflight with that image. A migration can partly take effect before a command fails. Schema column presence does not verify all types/constraints or data compatibility. No fresh bootstrap, reset, blind recovery or destructive cleanup is attempted.
6. Replace api/web only after all preceding commands succeed. A failed replacement can still have partial effects. No automatic rollback is claimed or attempted, because code rollback alone may not be compatible with applied migrations.
7. Probe engine `/health`, engine `/ready`, local web `/api/health`, then public `/api/health`, each bounded to30attempts with2second waits and4second full-response deadlines. Redirects, arbitrary HTML/homepage200responses, incorrect service identity and mismatched worker/send states do not pass. JSON bodies are capped at16KiB.

The engine health response must show mounted application services, exact expected worker/send posture and the source build identity calculated from the selected source before the image build. Source is checked again immediately after building; a changed source set stops before migration/replacement. Local/public web responses must report that same identity. The actual web health route also compares the engine identity with its own embedded identity and returns503for mixed versions. Worker readiness200is required when a worker is expected. When a worker is intentionally absent, the existing explicit503/not-mounted response is expected, and the final report states that send readiness has not been shown. No flag is toggled to make a probe pass.

The web health route makes a bounded server-side request to the configured engine's health route and returns only web service identity, status and engineReachable. It returns503after malformed/unavailable/redirected/oversized/stalled engine responses. It is uncached and reveals no environment values or detailed diagnostics. This tests web-to-engine reachability, not authenticated database reads or customer/provider operations.

Any failed command/probe exits nonzero, reports the failed phase and whether migration/replacement was confirmed, and never prints a success banner. A failed public probe is not downgraded to a warmup warning. Images are not pruned, preserving rollback options. Inspect actual current state and the backup before retrying; do not assume nothing changed merely because the script failed.

## Verification boundary

`node --test scripts/ops/release.synthetic.test.mjs` checks plan-only behavior, strict arguments/configuration, lock behavior, exact mutation ordering, failures before replacement, bounded JSON probes, send/worker mismatches and public failures with injected commands/responses. These are control-flow tests, not Docker image/container or production evidence. `docker/check-compose.py` is a separate static configuration check.

The complete native application browser rehearsal also checks the actual compiled engine and standalone web health route together, then stops that synthetic engine and verifies that the same web process reports503without stale success. This does not run Docker, a production migration, a public request or a provider call.

Passing probes means only the enumerated release checks passed. The source fingerprint identifies the enumerated source/configuration bytes, not the complete image or running machine. It rejects a different source identity, but is not a signed attestation: dependency installation, compiler/Node/base-image behavior, runtime environment/secrets, volume contents, proxy configuration and malicious identity forgery are outside this check. Two builds from identical source can have the same ID. It does not prove byte-reproducible images or safe production operation. They do not prove safe live sending, provider costs/consent, production OAuth/OTP delivery, data recovery, full functional acceptance or a launch-ready product.

## Source build identity

Engine and web npm prebuild hooks run `node scripts/ops/build-identity.mjs --prepare` from the repository root via their configured relative paths. It computes a path-and-byte-length-delimited SHA256with a versioned scheme, then writes identical generated TypeScript constants into engine/web source. The compiled artifacts use those constants, never a runtime environment override. The engine prebuild does not depend on a pre-existing generated file. The web Dockerfile and engine Dockerfile already invoke npm build, so both hooks are in their source flow; actual Docker builds remain unverified here.

`node scripts/ops/build-identity.mjs` inspects without writing and returns only scheme, file count and digest. It covers the included source extensions below apps/packages/workers/skills/scripts/docker and named root package/lock/build/Compose/update files. It includes application static assets, schema/migrations, scripts and customer instruction packs in those roots. The script's explicit file list/extension policy is the definition, not all repository files. It excludes environment files, generated identity files, dependency/install/build/test-output/cache directories, logs and tsbuildinfo. Files outside those roots and extensions are not attested. Included symbolic links are refused rather than followed. No file content, credentials or file list is exposed in the health response, only the digest.

After any included source change, rebuild engine and web together. Running a raw compiler or reusing old standalone output does not regenerate identity. Prebuild success alone is not proof that both artifacts compiled successfully. Verify actual engine/web responses and compare with a fresh source digest before release. The generated files are derivable; do not hand-edit them or treat the digest as permission. Tests use the same compiled source identity and reject stale/mixed/fabricated identity data.
