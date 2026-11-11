# Release plan: next production deploy (NOT approved, NOT started)

Live today: `94fa7ab` (deployed 12:40 IST 2026-11-11). Migrations 20261116 and 20261117 are already applied there. Team invites are OFF (`LEADLOOM_TEAM_INVITES_ENABLED` unset). Source `main` is ahead (bfe8c60, fc19a5a, a335e0f and later); none of it is live.

## What a release would change
1. Code: invite fixes (existing accounts can be invited, copy), mailbox connect engine and UI, gap/plan docs.
2. Database: one additive migration, `20261118_mailbox_password_auth` (4 new columns with defaults on `mailboxes`). No existing data changes. Rollback: older code still works.
3. Host settings (needs the host owner): `LEADLOOM_TEAM_INVITES_ENABLED=true` and `LEADLOOM_MAILBOX_CONNECT_ENABLED=true` in `.env`. Both default off. Invites send no email; the inviter tells the person to sign in or sign up.

## Why the last build took about an hour (evidence-based)
- `docker/web.Dockerfile` runs `COPY . .` before `npm ci`, so any source change throws away the dependency layer and reinstalls every package, then builds. The engine Dockerfile should be checked for the same pattern.
- The host shares Docker and one disk with BakeryPOS and FeeFree (disk 88% used, Docker.raw 226 GB at the time). Heavy disk I/O there slows every site.
- For comparison, the web app alone builds in about 36 s on a 2 CPU / 2 GB sandbox once dependencies are installed.

## Low-load approach (proposed)
1. Before: check free disk and load (`df -h`, `uptime`). Do not start if disk is above 90% or another build is running. Do not prune, delete volumes or restart Docker.
2. Build one image at a time, not both in parallel: `COMPOSE_PARALLEL_LIMIT=1 docker compose --profile application build engine`, then `web` (update.sh already builds before touching the running stack, so the old site stays up during the build).
3. Source fix to cut the cost (not done yet, needs a real Docker test before use): copy only `package.json` files and the lockfile, run `npm ci`, then copy sources, so the dependency layer is cached between releases. This changes build files only, not app behavior.
4. Watch it: a timeout of about 20 minutes; if exceeded, stop the build (the running stack is untouched) and report instead of retrying.
5. Run `update.sh` as is. It builds, runs `prisma migrate deploy` and `migrate status` with the new image BEFORE replacing containers, and stops without replacing anything if migration fails. Note: its last step runs `docker image prune -f` (dangling images only); that is existing behavior, flag if unwanted.
6. After: verify `/login` 200, `/` 200, engine `/health`, pos.dmpilot.org and feefree.dmpilot.org 200, `prisma migrate status` clean, and that only 20261118 was newly applied.

## Decisions needed (one ask, only when the UI is verified locally)
A. Approve running the release on the lab PC with the steps above.
B. Approve flipping the two flags to true (invites, mailbox connect) at the same time, or keep both off.
Not needed and not covered: any provider purchase, any live email, any Gmail/X/LinkedIn connection.
