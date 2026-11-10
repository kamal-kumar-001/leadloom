# Deploying the login build (host steps)

Done by the host agent or Kamal on the lab PC. Nothing here prints a secret.

1. `git pull origin main` is done by `update.sh`. Before it, run once: `bash scripts/ops/ensure-env.sh --mail-from-bakerypos <path to BakeryPOS .env>`. It only adds MISSING keys to `.env`: random `AUTH_SECRET` and bridge secret, the bridge and sign-up flags, and (with the option) the shared Resend key copied from BakeryPOS's `SMTP_PASSWORD`, the sender `Leadloom <noreply@mail.dmpilot.org>`, and emailed codes. It never overwrites a value.
2. GitHub sign-in needs `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` (the "Leadloom" OAuth app, callback `https://leadloom.dmpilot.org/api/auth/callback/github`). Add them privately: `bash scripts/ops/set-secret.sh AUTH_GITHUB_ID`, then `AUTH_GITHUB_SECRET` (silent prompt). Without them the GitHub button does not work.
3. `./update.sh`. It rebuilds, then runs `prisma migrate deploy`, which applies the additive migration `20261115_password_auth` (new columns and one new table; no existing data is changed).
4. Check: `curl -s http://127.0.0.1:${ENGINE_PORT:-4010}/health` and the site's /login page.

Rollback: re-run `update.sh` at the previous commit. The migration is additive, so older code keeps working.
