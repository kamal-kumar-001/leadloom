# Morning candidate access, 2026-11-23

This is preparation, not approval or a live release. Do not send the user's Mac to a temporary fixture localhost URL.

## Grounded source state

At 01:19 IST a read-only `git ls-remote origin refs/heads/main` returned the published baseline5b27ee96e5ca286a81959a2c5426b7619979e036. The current candidate includes later v90-v95 code, not a claim that GitHub main or the live host already has it. Re-read/fetch main and reconcile any intervening work before an approved push. Keep both author and committer Kamal <mrnormal128@gmail.com>. No new branch, force-push or history rewrite is proposed.

The candidate changes web, engine, shared contracts and packs. The candidate delta contains no database migration/schema, lockfile or deployment-infrastructure change. This does not establish the live database's migration state or prove a container/host build.

## Smallest intended Mac experience

After an independently approved and successful server release, use the existing authenticated Leadloom website on the Mac. In Projects & Tokens create/select the new idea's canonical project. In Custom / Advanced select that project and only needed scopes: context:read/write for memory and project:assets:read/write for founder/review workflows. The unchanged context-only preset is not sufficient. Do not use workspace wildcard tokens. The existing UI offers these custom scopes; create a new appropriately scoped credential rather than silently broadening an old one.

Download the candidate's nine-pack customer bundle. Configure its project-bound token privately, with the exact endpoint supplied by that release. Run its Node22.13+ CLI on demand from Antigravity. This introduces no persistent Mac background service and does not require us to operate the Mac overnight. Antigravity's actual installed agent/subagent/long-running capabilities remain unverified. Leadloom never starts or controls it.

Start with `reviews intake-file` for permitted caller-collected source records, then `founder init-file`, compact get, exact claim/report receipts and repo export into a new directory. Source collection, synthetic generation and app implementation remain caller-agent work; this is not proof that those outcomes have been performed.

## Exact unresolved release scope

The recommended intended route is an approved source push to main followed by an approved update of the existing server's engine AND web together to the same candidate identity. Do not update only the downloaded CLI or frontend. No new provider, paid hosting, Freestyle service, credential system or Mac daemon is proposed.

Before execution, identify and inspect the actual host/runtime, current source, authentication, resource headroom, independently recoverable backup and separately retained keys. Current host reachability, running commit, Docker build, auth-account access and live database migration status were not established by local source/native testing. Do not call these ready or blocked without the corresponding live check.

The supported repository entrypoint is `update.sh`, documented in scripts/ops/RELEASE.md. A plain invocation is plan-only. Explicit execution builds images, starts DB/cache dependencies, runs its migration/schema phase, replaces engine/web and checks health/public build identity. Even though this code delta adds no migration, the runner can apply pre-existing pending migrations. An app-restart approval must not silently become permission to apply unknown pending migrations. If the live preflight finds any, stop that phase and bring the exact reviewed change back for approval. No reset/bootstrap/db-push, destructive cleanup or automatic rollback is proposed. Fresh bootstrap is only for a separately verified disposable empty database, not the existing server.

Approval must cover source push and the selected server release/restarts with the reviewed database phase, not spending, enabling send workers/provider flags, publishing posts, store submissions or outreach. Preserve the inspected worker/send posture; do not enable features to make a probe pass. Verify matched actual public web/engine identities, then authenticated project/token/bundle access before telling Kamal the new endpoints are live. A failed public or authenticated check remains unverified.

Current build caveat is in the v94/v95 verification records. Separate typecheck/compile/generate and native workflow proof do not certify a normal combined build, Docker images, production operation or the user's morning Mac integration. No release was performed here.
