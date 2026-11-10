> **Paused (2026-11-10 21:53 IST).** See `STAGES.md`. Connectors come in stage 3, after login and dashboard work. Finish only in-flight work that is safe to stop.

# Team Beta brief (Antigravity, lab PC)

Read first: `docs/plan/PHASES.md`, `docs/plan/CONNECTORS.md`, `docs/context/TEAM_CONTEXT_BETA.md`.
Write only in `apps/engine/src/modules/{waterfall,signals,ai-researcher,validator}/**` and `workers/**`. `git pull origin main` first, push to `main`, never reset --hard, never touch `.env`, never run update.sh.

Tasks:
1. Connector SDK in `apps/engine/src/modules/waterfall/connectors/`: interface `{id, capabilities, auth, rateLimit, run(input, ctx)}`, a registry, and an explicit error result (never fake success) when no key is present.
2. Implement from public docs: Apollo, Hunter, Dropcontact, PDL, ZeroBounce, NeverBounce, Serper, OpenAI, Anthropic, Ollama. One file each plus a vitest spec with recorded fixtures (no live calls in tests).
3. Keys arrive only through the vault port; never log them.
4. Report via `docs/context/SYNC_FEED.md`.
5. Read `docs/plan/FOUNDATIONS.md`. Gate waterfall dispatch and enrichment credit use through `EntitlementService` (`apps/engine/src/modules/entitlements`), injected as a port; do not hard-code plan checks.

Done: `npx vitest run` and `npx tsc --noEmit` pass in `apps/engine`.


---
## Beta: bounded Stage 1 login task (2026-11-10 22:45 IST, from Kamal's "assign some tasks to team B")
This is the only active task. Connectors, waterfall, Stage 2 and 3 stay parked. Rules: `git pull --rebase origin main` before every push, never force-push, rerun checks after any merge, commit as Kamal, main only, never touch `.env`, never run update.sh, no deploy, no real email, no provider calls, no secrets in code or logs.

**Goal: an independent black-box login test suite**, so Stage 1 is judged by someone other than the author. You write tests only. Do not edit `apps/engine/src/modules/auth/**` (Gamma), `apps/web/**` (Alpha) or `packages/database/**`. If a test finds a bug, report it in `docs/context/SYNC_FEED.md` with the request, the actual response and the expected one. Do not fix it yourself.

Write only in `tests/login-e2e/**` (new directory) plus your SYNC_FEED entry.
1. Read the contract in `docs/plan/STAGES.md` (Stage 1, engine endpoints `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/me`, `/auth/provision`).
2. Start the engine only with `DATABASE_URL=postgresql://...@localhost/<throwaway db> sh scripts/dev/stage1-harness.sh up` (refuses non-local DBs; mail goes to a local file sink, no mail is sent; stop it with `down`). Use a throwaway local Postgres you create yourself. If none is available, say so in SYNC_FEED and stop; do not fake results.
3. Tests (plain Node `fetch` over HTTP, `node --test` or vitest, whichever the repo already uses), each asserting status and body shape:
   - signup then wrong code, right code, reused code, expired code (set the TTL by env if supported, else mark "not covered");
   - login before verification is refused; after verification returns a session; wrong password gives the same generic error as an unknown email (no account enumeration; compare bodies);
   - resend cooldown and attempt cap;
   - reset: wrong code, right code, old session rejected afterwards;
   - signup code cannot be used for reset;
   - `/auth/me` with no token, a malformed token, a token signed with the wrong key: all 401;
   - a password-session token must be refused by `/auth/provision` (it must never act as a bridge token);
   - rate limits return 429 and do not lock out a different email;
   - the response bodies and the engine log contain neither the code nor the password.
4. Output: a short `tests/login-e2e/README.md` with how to run it and a results table (test, pass/fail, evidence line from the actual run with timestamp). Anything not run is marked "not run", never "pass".
5. Report in `docs/context/SYNC_FEED.md` when pushed.
