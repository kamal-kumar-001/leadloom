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

## Recommended route (decision-ready, 2026-11-11 evening)

RECOMMENDED: prebuilt images built by GitHub Actions, pulled by the host. This removes the only known stall source (the ~1h image build/export I/O on the shared host) from the release entirely. The host then does `docker compose pull` + `up -d`: the brownout window for pos/feefree shrinks from up-to-an-hour of disk saturation to the seconds-minutes of a container replace. Rollback is clean: images are tagged with the git SHA, the previous tag stays in the registry, and `docker compose up` with the previous tag restores the old stack in minutes (migrations 20261118-23 are additive, so old code runs fine against the migrated DB).

What it needs from Kamal (three approvals, all one-time):
1. Add ONE workflow file (`.github/workflows/release-images.yml`) to the public repo that builds the three compose images on a manually dispatched release tag and pushes them to GitHub Container Registry under his account. The repo's built-in GITHUB_TOKEN is enough; no new secret is needed if the GHCR package is public (the repo itself is public). Public repos get free Actions minutes. The draft workflow is in docs/plan/proposed-release-workflow.yml - it is inert until moved into .github/workflows/, which only Kamal's yes authorizes.
2. Run `uname -m && docker version --format '{{.Server.Arch}} / {{.Server.Driver}}'` on the host once (read-only, 5 seconds). If the host is arm64 instead of x86_64 the workflow needs one extra buildx line; better to know before the release, not during.
3. Approve the updated update.sh that pulls the prebuilt tag instead of building (prepared in the same release PR; current update.sh keeps working for route B).

What remains unknown, stated honestly:
- Host CPU architecture (blocks nothing until the first build; see ask 2).
- Exact image sizes (est. 1-2 GiB total pull; 33G free disk is ample either way).
- Whether GHCR public pulls need any host login. They do not for public packages; if Kamal prefers the package private, the host needs a one-time `docker login ghcr.io` with a read:packages token.

FALLBACK (route B): on-host build as today, with a supervised window and the known residual risk that pos/feefree time out for up to about an hour if the export stall recurs. The Dockerfile layering fix (package.json before COPY . .) is intentionally NOT committed: it is unverifiable without a real build and the stall root cause is unproven. It rides along only if route B is chosen.

NOT RECOMMENDED: ad-hoc cross-load of images built on an unknown-arch machine, or pausing co-hosted apps during the build (both trade the user's other products' availability or correctness for convenience).

## Release (once a route is chosen)
`update.sh` order is build, then `prisma migrate deploy` + `migrate status` with the new image, then replace containers; if migration fails nothing is replaced. Last step runs `docker image prune -f` (existing behavior, dangling images only; not a new cleanup). After: `/login` 200, `/` 200, engine `/health`, pos and feefree 200, only 20261118 newly applied.

## The one decision for Kamal (after UI, security and IMAP evidence exist)
A single yes/no on the whole release: new code (main at release time), migrations 20261118-20261123, and the two feature flags on, with the chosen build route and its honest residual risk stated. Separate decisions that must NOT be bundled: the removed-member recovery option (G1_MEMBER_RECOVERY_OPTIONS.md), provider purchases, live email sending, IMAP polling, connector live testing, any Gmail/X/LinkedIn connection. Host facts gathered 2026-11-11 19:39: / has 33G available; Docker VM uses 3.55GiB. Host CPU architecture and Docker runtime still unconfirmed.
