# Release plan: next production deploy (NOT approved, NOT started)

Live today: `94fa7ab` (deployed 12:40 IST 2026-11-11). Migrations through 20261117 are applied there. Team invites are OFF (`LEADLOOM_TEAM_INVITES_ENABLED` unset). Source `main` is ahead (now `4900244`); none of it is live.

## What a release would change (updated 2026-11-11 evening)
1. Code, all verified locally with no production effect yet:
   - G1 team invites end-to-end (invite, accept with re-auth, role enforcement, revoke, expiry, suspend-on-remove); G2 mailbox connect with real login check and AES-GCM sealing; G6 connector registry + honest BYOK states + inert test-connection route; G9 approval-before-send hardening with per-item snapshot review; G10 reply attribution with ambiguity-safe halting; poll bridge gated by LEADLOOM_IMAP_POLL_ENABLED (default off).
   - Removed-member recovery is an OPEN DECISION (docs/plan/G1_MEMBER_RECOVERY_OPTIONS.md): today removal suspends the whole account with no restore path.
2. Database: six additive migrations, 20261118 through 20261123 (mailbox password auth columns, G9 approval snapshot fields, G10 inbound_replies, ambiguity marker). All additive with defaults; older code keeps working, so rollback is code-only.
3. Host settings (needs the host owner): `LEADLOOM_TEAM_INVITES_ENABLED=true` and `LEADLOOM_MAILBOX_CONNECT_ENABLED=true` in `.env`. Both default off. Invites send no email. Everything else new stays off by default: LEADLOOM_IMAP_POLL_ENABLED, LEADLOOM_CONNECTORS_LIVE_ENABLED must remain UNSET in production until separately approved.

## What is known about the last stall
- The 11:36 build stalled about an hour in the image layer EXPORT step (host report in the Antigravity chat), then finished by itself and update.sh completed. Cause was Docker VM / shared-disk I/O. Other sites (pos, feefree) saw timeouts while the OLD stack was still running, so keeping the old stack up does NOT protect the other apps during the build.
- `COPY . .` before `npm ci` in both Dockerfiles means a code change reinstalls dependencies. That is wasted work and a possible contributor, NOT an established root cause of the export stall.
- Unknown and not yet checked (read-only host questions): host CPU architecture, Docker runtime (Desktop VM vs engine), free disk now, image sizes.

## Recommended route (proposal, not yet decision-ready facts)

PROPOSED: build the two production images off-host (GitHub Actions), push them PRIVATE to GHCR, and have the host pull them instead of building. This removes on-host build work - the step that stalled for about an hour last time - but it does NOT remove pull, layer extraction, or container replacement, which also stress the Docker VM. How long any brownout lasts is UNMEASURED; no uptime or duration is promised.

What is actually established:
- Host arch is x86_64 and Docker is a VM-backed runtime (read-only diagnostic, 2026-11-11 19:39), so standard GH runner images (linux/amd64) match.
- / has 33G free. Whether that is ample is UNKNOWN until the real compressed image sizes and extracted coexistence footprint are measured; estimates are not evidence.
- Migrations 20261118-23 are additive (new columns/tables with defaults). That alone does NOT prove old-code compatibility or a safe rollback; there is no backup/restore runbook and no rollback test. Treat migration rollback as UNSUPPORTED until one exists.
- The release build covers only engine + web (the scraper service is on an unused profile and has no Dockerfile; irrelevant to this release).

The minimal approval choice for Kamal, nothing bundled:
1. Allow one workflow file (draft inert at docs/plan/proposed-release-workflow.yml) to be activated at .github/workflows/release-images.yml. This is the BUILD-ONLY gate: it builds engine + web on the standard GitHub-hosted runner and pushes to GHCR PRIVATE (the default on first publish). Nothing on the host changes; gates 2 and 3 remain separate later decisions. Cost facts verified against docs.github.com on 2026-11-11: hosted-runner compute is free and unlimited on public repositories; GHCR container-image storage and bandwidth are currently free (GitHub commits to one month advance notice before any change); overage beyond included quotas is blocked when no payment method is on file and monthly-billed accounts default to a $0 spending limit. Whether a payment method is on file is unknown. The workflow requests packages: write for GITHUB_TOKEN, but that declaration does not override repo/org Actions policy; the grant is UNVERIFIED until the first run, and a blocked first run is a settings check, not a failure.
2. Allow a one-time `docker login ghcr.io` on the host with a read:packages token so the host can pull the private images. (Making the packages public instead would be a separate disclosure decision; the repo being public does not cover it, and it is not requested.)
3. Allow the pull-based update.sh variant in the same main commit as the release (main only, no release branch), run by the host owner in a supervised window.

First-build MEASURED results (run 43062288976, 2026-11-11 16:50-16:54 UTC, success in 3m17s):
- leadloom-engine: 11 layers, 668.0 MB compressed; image index sha256:0bb659f5..., amd64 manifest sha256:bd26e514...
- leadloom-web: 8 layers, 106.3 MB compressed; image index sha256:a55baf08..., amd64 manifest sha256:ca996750...
- Total pull size approx 774 MB compressed. Extracted and old+new coexistence footprint still UNMEASURED (only readable on the host after an approved pull); with about 0.8 GB compressed input, 33G free has ample margin for any realistic extraction factor, but the exact number is recorded after the first host pull.
- VISIBILITY INCIDENT, corrected: packages connected to a PUBLIC repo inherit PUBLIC visibility on first publish via Actions - the "first publish defaults private" assumption was wrong. Exact exposure windows: leadloom-engine public 16:52:26Z -> 17:09:41Z (17m15s); leadloom-web public 16:53:44Z -> 17:09:59Z (16m15s). Run: https://github.com/kamal-kumar-001/leadloom/actions/runs/43062288976 . Packages: https://github.com/users/kamal-kumar-001/packages/container/package/leadloom-engine and .../leadloom-web . Both set to Private through the owner's GitHub session; anonymous pull verified 403 from outside for both.
- CONTENT INSPECTION (build inputs at built SHA 3df93fa): no .env/secret files, data dumps or backups exist in the repo tree (only source files with password/token in their names, and placeholder-only .env.example). .dockerignore excludes .git, .env, .env.*, node_modules, logs, data dirs. Dockerfiles pass no ARG/ENV secrets; the only credential-shaped string in image history is the synthetic placeholder `DATABASE_URL=postgresql://synthetic:synthetic@localhost:...` in docker/engine.Dockerfile. The workflow passes GITHUB_TOKEN only to the registry login step, never into the image. So: no evidence of exposed credentials, but this is inspection of build INPUTS, not a bit-exact layer enumeration - actual layer blobs could not be downloaded because no read:packages token exists (minting one was ruled out). Bit-exact layer listing needs either a read:packages token (vault) or an approved read-only inspect workflow run.
- PUBLISHING PAUSED pending preventive control. Candidate controls (owner decision): (a) a post-publish verify step in the workflow that fails loudly if any leadloom package is public; (b) a mandatory verify-and-flip checklist after any NEW package's first run; (c) repo goes private at completion, which changes inheritance. Before ANY subsequent push to the existing packages, their Private setting must be re-verified (retention is assumed, not yet observed).
- The repo token cannot read the private packages (404 masked), matching gate 2: host pull needs a read:packages login (unapproved).
- Durable lesson recorded in the workflow draft: after every first publish of a new package, verify actual visibility and set Private explicitly.

Remaining verifiables after later gates, in order, none guaranteed before observation:
- Extracted and side-by-side disk footprint on the host (read-only `docker images` / `system df`).
- Actual pull duration and host load during a supervised pull (watch pos/feefree health externally throughout).
- Container-replace behavior with the new images, with the previous tag still present locally.
- Rollback-by-repull of the previous tag: only claimable after it has been exercised once.
- Until those are observed, the honest statement is: "build risk moves off the host; pull/extract/replace risk remains and is unmeasured; rollback is planned but unproven."

NOT RECOMMENDED: ad-hoc cross-loaded images from an unknown-arch machine; pausing co-hosted apps; committing the Dockerfile layering fix unverified (it rides along only if on-host build is chosen after measurement).
## Release (once a route is chosen)
`update.sh` order is build, then `prisma migrate deploy` + `migrate status` with the new image, then replace containers; if migration fails nothing is replaced. Last step runs `docker image prune -f` (existing behavior, dangling images only; not a new cleanup). After: `/login` 200, `/` 200, engine `/health`, pos and feefree 200, only 20261118 newly applied.

## The one decision for Kamal (after UI, security and IMAP evidence exist)
A single yes/no on the whole release: new code (main at release time), migrations 20261118-20261123, and the two feature flags on, with the chosen build route and its honest residual risk stated. Separate decisions that must NOT be bundled: the removed-member recovery option (G1_MEMBER_RECOVERY_OPTIONS.md), provider purchases, live email sending, IMAP polling, connector live testing, any Gmail/X/LinkedIn connection. Host facts gathered 2026-11-11 19:39: / has 33G available; Docker VM uses 3.55GiB. Host CPU architecture and Docker runtime still unconfirmed.
