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
1. Allow one workflow file (draft inert at docs/plan/proposed-release-workflow.yml) to be activated at .github/workflows/release-images.yml. It builds engine + web on GitHub-hosted runners and pushes to GHCR PRIVATE (the default on first publish). Public-repo hosted-runner COMPUTE is generally free; Actions storage and retention are not necessarily free, and no cost claim is made here beyond that.
2. Allow a one-time `docker login ghcr.io` on the host with a read:packages token so the host can pull the private images. (Making the packages public instead would be a separate disclosure decision; the repo being public does not cover it, and it is not requested.)
3. Allow the pull-based update.sh variant in the same main commit as the release (main only, no release branch), run by the host owner in a supervised window.

What can be verified only AFTER that approval, in order, none guaranteed before observation:
- Real compressed image sizes from the first build's registry metadata, then extracted and side-by-side disk footprint on the host (read-only `docker images` / `system df`).
- Actual pull duration and host load during a supervised pull (watch pos/feefree health externally throughout).
- Container-replace behavior with the new images, with the previous tag still present locally.
- Rollback-by-repull of the previous tag: only claimable after it has been exercised once.
- Until those are observed, the honest statement is: "build risk moves off the host; pull/extract/replace risk remains and is unmeasured; rollback is planned but unproven."

NOT RECOMMENDED: ad-hoc cross-loaded images from an unknown-arch machine; pausing co-hosted apps; committing the Dockerfile layering fix unverified (it rides along only if on-host build is chosen after measurement).
## Release (once a route is chosen)
`update.sh` order is build, then `prisma migrate deploy` + `migrate status` with the new image, then replace containers; if migration fails nothing is replaced. Last step runs `docker image prune -f` (existing behavior, dangling images only; not a new cleanup). After: `/login` 200, `/` 200, engine `/health`, pos and feefree 200, only 20261118 newly applied.

## The one decision for Kamal (after UI, security and IMAP evidence exist)
A single yes/no on the whole release: new code (main at release time), migrations 20261118-20261123, and the two feature flags on, with the chosen build route and its honest residual risk stated. Separate decisions that must NOT be bundled: the removed-member recovery option (G1_MEMBER_RECOVERY_OPTIONS.md), provider purchases, live email sending, IMAP polling, connector live testing, any Gmail/X/LinkedIn connection. Host facts gathered 2026-11-11 19:39: / has 33G available; Docker VM uses 3.55GiB. Host CPU architecture and Docker runtime still unconfirmed.
