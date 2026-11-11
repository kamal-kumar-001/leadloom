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

## Candidate routes (none verified safe yet)
1. Build on the host as before. Same stall risk. Serial build lowers concurrency only; update.sh may build again. Any disk cutoff or time limit is a guess, and stopping a build may not stop the underlying export I/O. Residual outage risk: other apps may time out again for up to about an hour.
2. Build images elsewhere and load them on the host. Needs: matching architecture (unknown), a place to hold the images (a registry or file transfer: no authority or account for that exists, and I have no Docker here to test), and a change to compose/update.sh to use prebuilt images. Not available now; would need Kamal's decision on any registry/account.
3. Smaller exports: layering fix (`package.json` first, `npm ci`, then sources) only helps if the export, not the install, is the slow part. Untestable without Docker; do it only as part of a supervised release.
Recommendation until a route is verified: do not release yet. Ask the host agent for the read-only facts above (arch, Docker runtime, disk, image sizes), then pick the route.

## Release (once a route is chosen)
`update.sh` order is build, then `prisma migrate deploy` + `migrate status` with the new image, then replace containers; if migration fails nothing is replaced. Last step runs `docker image prune -f` (existing behavior, dangling images only; not a new cleanup). After: `/login` 200, `/` 200, engine `/health`, pos and feefree 200, only 20261118 newly applied.

## The one decision for Kamal (after UI, security and IMAP evidence exist)
A single yes/no on the whole release: new code (main at release time), migrations 20261118-20261123, and the two feature flags on, with the chosen build route and its honest residual risk stated. Separate decisions that must NOT be bundled: the removed-member recovery option (G1_MEMBER_RECOVERY_OPTIONS.md), provider purchases, live email sending, IMAP polling, connector live testing, any Gmail/X/LinkedIn connection. Host facts gathered 2026-11-11 19:39: / has 33G available; Docker VM uses 3.55GiB. Host CPU architecture and Docker runtime still unconfirmed.
