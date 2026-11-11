# Release plan: next production deploy (NOT approved, NOT started)

Live today: `94fa7ab` (deployed 12:40 IST 2026-11-11). Migrations 20261116 and 20261117 are already applied there. Team invites are OFF (`LEADLOOM_TEAM_INVITES_ENABLED` unset). Source `main` is ahead (bfe8c60, fc19a5a, a335e0f and later); none of it is live.

## What a release would change
1. Code: invite fixes (existing accounts can be invited, copy), mailbox connect engine and UI, gap/plan docs.
2. Database: one additive migration, `20261118_mailbox_password_auth` (4 new columns with defaults on `mailboxes`). No existing data changes. Rollback: older code still works.
3. Host settings (needs the host owner): `LEADLOOM_TEAM_INVITES_ENABLED=true` and `LEADLOOM_MAILBOX_CONNECT_ENABLED=true` in `.env`. Both default off. Invites send no email; the inviter tells the person to sign in or sign up.

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
A single yes/no on the whole release: new code, migration 20261118, and both feature flags on, with the chosen build route and its honest residual risk stated. Not covered: provider purchases, live email, any Gmail/X/LinkedIn connection.
