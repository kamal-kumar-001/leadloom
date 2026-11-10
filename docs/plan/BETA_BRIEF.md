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
## Beta: Stage 1 login screens (re-scoped 2026-11-10 23:15 IST; Kamal does the detailed testing, so this is BUILD work, no test matrix)
Replaces the earlier test-suite task. Connectors stay parked. Rules: `git pull --rebase origin main` before every push, no force-push, rerun `tsc` and `next build` after any merge, commit as Kamal, main only, never touch `.env`, never run update.sh, no deploy, no real email, no secrets in code or logs, no mock success: a failed call shows the engine's real error.

Build the email/password and emailed-OTP screens in `apps/web`, matching the current theme tokens (no hard-coded colors, light and dark) and reusing `@leadloom/ui`. Same step pattern as BakeryPOS `apps/web/app/forgot-password/page.tsx` (email, then 6-digit code with resend countdown, then new password with show/hide). One shared component set for signup verification and reset.

Your files (create or edit only these): `apps/web/components/auth/**` (new), `apps/web/app/login/page.tsx`, `apps/web/app/signup/page.tsx`, `apps/web/app/forgot-password/page.tsx` (new), `apps/web/app/verify-email/page.tsx` (new). Keep the existing Google and GitHub buttons.
Gamma builds (do not touch): `apps/web/auth.ts`, `auth.config.ts`, `app/api/**`, `app/app/layout.tsx`, `lib/engine-client.ts`.
Alpha keeps: dashboard shell and the L0 text removal in marketing files (see `LANDING.md`). Do not edit those.

Contracts you call:
- Login: `signIn('credentials', { email, password, redirect: false })` from `next-auth/react`. Gamma wires the provider. Show "Email not verified" and send the user to the verify step when the result error code is `email_not_verified`. Any other failure shows one generic message ("Email or password is incorrect"). Never reveal whether the email exists.
- Everything else goes to the same-origin route `POST /api/auth-flow/<action>` with a JSON body, where action is one of `register`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`. Bodies are exactly the engine's: register `{email,password}` (read `apps/engine/src/modules/auth/` routes and `docs/plan/STAGES.md` for exact fields and response codes), verify-email `{email,code}`, resend-verification `{email}`, forgot-password `{email}`, reset-password `{email,code,password}`. The browser never calls the engine directly (it would fail on CORS).
- Show real states: 400 invalid or expired code (generic), 429 rate limit with a wait message, 503 mail disabled ("Email sign-up is not available yet"), network error. Resend button honors a 60 second cooldown. Password rules: min length per the engine's error message; do not invent stricter client rules.
- No mock data, no fake success, no "check your inbox" screen when the engine said it could not send.
Done: `npx tsc --noEmit` and `next build` pass in `apps/web`. Report in `docs/context/SYNC_FEED.md`, one short entry.
