# LeadLoom: missing-work plan (comprehensive gap list, staged)

Basis: source inspection of `main` at `c3c7a82` (live on 2026-11-11), cross-checked against
`STAGES.md`, `PHASES.md`, `GATING.md`, `LANDING.md`, `FOUNDATIONS.md` and `SYNC_FEED.md`.
Ordering is still governed by `STAGES.md`: login, then dashboard, then connectors, then landing.
This file is a plan only. Nothing here authorizes a deploy, a real send, a provider call, spend
or an account change. Ground rules in `STAGES.md` ("Rules for all three teams") apply to every step.

Status labels used below:
- **Live**: working on leadloom.dmpilot.org today.
- **Wired**: real code path mounted and reachable, verified locally or live as noted.
- **Parked**: built, tests pass, deliberately not mounted (flag off or no route).
- **Sample**: UI fixture, labelled "Sample"/"Demo data" in the UI. Not real data.
- **Missing**: no code, or code exists but loses/misrepresents data.

---

## 1. Verified current state (what is real today)

| Area | Status | Evidence |
|---|---|---|
| Email/password signup, 6-digit OTP verify, reset, login, session revocation | **Live** | `apps/engine/src/modules/password-auth`, routes in `main.ts`, migration `20261115_password_auth`; login reported working by Kamal; not re-observed by the build team |
| GitHub sign-in | **Missing on host** | OAuth app exists, credentials in vault; `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` absent on the host (ensure-env 2026-11-11). UI honestly shows "not available yet" |
| Google sign-in | **Missing (deferred)** | Deferred by Kamal; no credentials supplied |
| Real mail delivery (signup/reset OTP) | **Unverified** | Shared Resend Free key configured host-side; inbox delivery never observed; domain status unknown. Approved scope: requester OTP mails only |
| Workspace dashboard reads (summary, tables, mailboxes, campaigns, suppressions, experiments) | **Live (read-only)** | `workspace-read` service + `/workspace/*` routes; web wired (SYNC_FEED 03:36-05:05) |
| Provider key vault (save/list/delete) | **Live** | `modules/vault` AES-256-GCM; Settings card + connectors page save real keys. Labels say "Saved", not "verified" |
| Roles | **Partial** | Engine roles `admin`/`member`/`read_only`; `canWrite` + admin checks enforced on vault routes. No `owner`, no per-member permissions |
| Team / organization invites | **Missing** | No invitation model, route or accept flow. `User.workspaceId` ties one user to one workspace. `team_invite` mail kind declared but unused. Settings says "not available yet" (honest); engine invitations exist from 528e088 behind a default-off flag |
| Entitlements | **Parked (honest)** | `EntitlementService` + `DEFAULT_PLANS` exist; `LEADLOOM_ENTITLEMENTS_ENFORCED` off; health reports `not_enforced`; no engine endpoint returns a decision to the web (`GATING.md` gap) |
| Connectors (11 providers) | **Parked** | `waterfall/connectors/*` built, fixture-tested, no route imports them. Web `/app/connectors` merges real vault keys with a hardcoded catalog (`ALL_CONNECTORS` in the page) under a "Demo data" badge; cost/hit-rate numbers in it are hardcoded estimates |
| Connector credential sealer | **Parked duplicate** | `waterfall/credentials/credential-sealer.ts` duplicates the vault. Stage 3 reconciles it onto `modules/vault`; do not use it for real keys |
| Test-connection service | **Parked** | `waterfall/connectors/test-connection.service.ts` built, not mounted |
| Waterfall engine (DAG, pre-flight, dispatch) | **Parked** | `waterfall/` controllers built; routes mounted only behind `LEADLOOM_WATERFALL_API_ENABLED` (off). `DomainCacheService` is in-memory (data lost on restart; `enrichment_cache` table unused). Web grid `runWaterfallForSelected` is a store simulation |
| Outbound / sequencer | **Parked, partial** | SMTP transport, IMAP poller, OAuth2 connect/token loop built as a library (`outbound/transport`). `POST /outbound/jobs` enqueues only; no worker consumes the queue. No mailbox connect routes. Health: `outboundSendingEnabled:false` |
| Idea validator | **Parked, volatile** | `ValidatorService` stores experiments in an in-memory `Map` (lost on restart) despite `ValidationExperiment`/`SmokeTestPage`/`WaitlistLead` tables existing. Routes behind `LEADLOOM_VALIDATOR_API_ENABLED` (off). Public `/v/[slug]` pages + rate-limited lead proxy exist in web |
| Signals, AI researcher, scraper worker | **Parked** | `signals/signal-listener.service.ts`, `ai-researcher/ai-researcher.service.ts`, `workers/scraper` exist; nothing mounted or queued |
| Platform admin console | **Missing (honestly gated)** | `/admin` denied in production; dev-only page uses labelled `MOCK_TENANTS`/`MOCK_AUDIT_LOGS`. No platform-admin tables |
| Landing page | **Live, being reworked** | Current page still links the public `/workspace` demo ("Open Canvas") and carries pre-cleanup copy. Landing workstream owns the fix (hero email CTA, demo removal, theme-aware logo) |
| Public `/workspace` demo route | **Live fixture** | `apps/web/app/workspace/page.tsx` renders the simulated grid unauthenticated; user asked to remove it |
| Tables/campaigns/validator UI | **Mixed** | Real workspace lists on top; interactive grid/sequence/validator fixtures below under "Sample preview" labels. `/app/validator` topbar still has a removable sample claim (noted by Beta) |

---

## 2. Deferred external items (need Kamal, not code)

1. **GitHub host secrets**: `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` must reach the host `.env`. Campus SSH is unreachable and the secret must never go through the Antigravity chat. Minimal manual step by Kamal at the next active moment.
2. **Google OAuth credentials** (login): deferred by Kamal.
3. **Resend proof**: send one real OTP to Kamal's own address when he next tests; confirm domain status on the shared Free plan (hard 100/day, 3000/month shared across products).
4. **Provider API keys** Kamal wants live (Apollo, Hunter, OpenAI first), entered through the app vault.
5. **Google and Microsoft OAuth apps for mailbox connect** (Phase 2/3 in ACCESS_NEEDS.md).
6. **Explicit go before any real outreach send** (Phase 4). Not covered by the OTP-mail approval.
7. **Invite emails** (new): sending `team_invite` mail to an *invitee* is outside the approved requester-OTP scope and needs Kamal's explicit approval of the flow before any send.
8. **Product decisions**: owner role, plan/pricing, and whether existing users may belong to several workspaces. None is decided.

---

## 3. Stage A: team and organization invites (user request 2026-11-11 10:03)

Goal: the account creator can invite members into the *same* workspace with a role, and the
engine enforces access. Additive only: no migration rewrites, existing users stay admins of
their own workspaces. Pattern follows the BakeryPOS team flow (to be compared once its source is read).

**Model (engine only, flag `LEADLOOM_TEAM_INVITES_ENABLED`, default off, not deployed). Reference: BakeryPOS has an OWNER role seeded for the creator, per-role permission bundles, a last-owner guard, and no self-delete (read from `kamal-kumar-001/BakeryPOS`, packages/types/src/permissions.ts and apps/backend/src/modules/users/users.service.ts). Leadloom takes the owner, last-admin and no-self-removal rules now; per-permission toggles are a later step.**
- Migrations `20261116_workspace_invitations` and `20261117_workspace_owner` (additive). An invitation binds an email to a workspace and a role (admin, member or read_only), expires after 7 days, and carries no token or secret. The workspace creator is recorded as owner (`workspaces.owner_user_id`; backfilled only from the engine's audit log, where exactly one creation record exists for the workspace and that user is still its admin. Ambiguous, operator-created or record-less workspaces stay NULL: no owner, and owner-only actions are denied until someone decides. Before release, count how many live workspaces end with a NULL owner and report them). No new role value.
- Engine roles are admin, member and read_only (an earlier note that said only admin and member was wrong).
- Creating an invitation does nothing to the invitee. Signing up with the address creates a normal personal workspace; the invitation stays open. The invited user must sign in with a verified identity and explicitly accept (`GET /me/invitations`, `POST /me/invitations/:id/accept`). Verified means a completed email verification or a provider-verified provisioning record. Accept works only for the invitation's exact address, only while open and unexpired, and only if the user's current workspace is pristine (sole member, creator, and no data in any workspace-scoped table, default plan and settings). The current workspace row is locked first so concurrent writers wait; a guard test fails when a new table appears that the check has not been reviewed against. Then the user moves, the empty personal workspace is deactivated (not deleted) and the session version is bumped. Otherwise nothing moves.
- Admin routes: `GET/POST /workspace/invitations`, `DELETE /workspace/invitations/:id`, `GET /workspace/members`, `PATCH/DELETE /workspace/members/:id`. Workspace and actor come only from the session. Caps of 25 open and 20 per day; request limiters; audit rows. Create returns `emailSent:false`.
- Owner rules: the owner cannot be demoted or removed by anyone; only the owner can grant or take the admin role or invite an admin; nobody removes themselves; the last active admin is protected. Removal suspends (`disabled_at` plus session bump), never deletes. Ownership transfer is not built.
- An address that already has an account cannot be invited (explicitly unsupported, nothing is forced to move). Multi-workspace membership is a larger change and is not built.
- Tests: squatting the address gains nothing; revoked, expired, wrong-address and unverified accepts are refused; data-holding accounts are never moved; concurrent membership changes keep an admin. Run on real Postgres locally.

**Open decisions (not assumed):**
- Invite email: sending to an invitee is outside the approved requester-OTP scope and no mail is sent. Until Kamal approves the flow and recipient semantics, the UI would tell the admin to ask the person to sign up with that address, then accept in Settings.
- Per-permission toggles and custom roles (BakeryPOS has them) and ownership transfer.

**Remaining:**
- A3: done in the engine (see model). Web side remains.
- A6 (web): Settings team card with real member and pending-invite lists, invite form, revoke, honest states. Keep "not available yet" until A2 and A4 are live-verified.
- A8: browser-verified end to end on a non-production stack: owner invites, invitee signs up, role limits enforced, revoke and expiry refused.

Done when: a second real user joins a workspace by invitation and role limits are enforced server-side, verified in a browser.

## 4. Stage B: landing and identity (owned by the landing workstream; tracked here for completeness)

Per the user's 2026-11-11 10:03 request and `LANDING.md`: remove Source Code / Open Canvas and
the public `/workspace` demo entry; hero email CTA with the exact "Find Leads" button prefilling
`/signup`; repeat CTA near the bottom; theme-aware logo/favicon contrast in light and dark.
Audit remaining marketing claims for honesty (e.g. pricing-card perk lines) before they stay.
Do not delete the authenticated `/app`. Mega menus and `REFERENCE_MAP.md` stay Stage 4 per `LANDING.md`.

## 5. Stage C: connectors (STAGES.md Stage 3; one connector at a time)

- **C1 (Gamma)**: mount a connector registry endpoint from `waterfall/connectors/registry.ts` returning id, capabilities and status; web reads it (replaces the hardcoded `ALL_CONNECTORS` catalog, including its hardcoded cost/hit-rate numbers).
- **C2 (Gamma)**: retire `waterfall/credentials/credential-sealer.ts` onto `modules/vault` as a thin write-only facade; no second key system.
- **C3 (Gamma)**: mount `test-connection.service` as `POST /connectors/:id/test` (session + admin); result recorded as last-test status, never implied before a real test. Live provider calls need Kamal's approval and his keys.
- **C4 (web)**: connectors page consumes the registry; per-connector status badge generated from it (Available/Beta/Coming soon), Configure opens the existing vault modal, Test button appears only when a key exists.
- **C5 (Beta)**: contract-test suite per connector using recorded fixtures; one connector (Apollo) brought to "Available" first.

## 6. Stage D: waterfall execution (after C)

- **D1 (Gamma)**: DB-backed `DomainCacheService` on the existing `enrichment_cache` table (30-day TTL), replacing the in-memory map.
- **D2 (Gamma)**: mount waterfall routes behind the existing flag for staged testing; dispatch persists jobs; BullMQ worker executes cascades (respect 4GB VPS budgets).
- **D3 (web)**: grid `runWaterfallForSelected` calls the real endpoint and reflects cell states; simulated store path removed. Pre-flight estimate bar wired to the real estimator.

## 7. Stage E: mailboxes and outbound (Phase 3-4; sends need explicit go)

- **E1 (Gamma)**: mailbox connect routes on the existing OAuth2 library (Google/Microsoft apps from item 2.5); tokens in `prisma-token-vault`; refresh via the token loop.
- **E2 (Gamma)**: dispatch worker consumes `outbound-queue` (jitter, rotation, daily usage tables already modeled); suppression and unsubscribe already exist.
- **E3 (web)**: mailbox UI moves from raw list to connect/health actions as each capability lands; "Add mailbox"/"DNS check" stay disabled until then.
- **E4**: real sends only after Kamal's explicit approval (item 2.6).

## 8. Stage F: validator persistence

- **F1 (Gamma)**: `ValidatorService` persists to `ValidationExperiment`/`SmokeTestPage`/`WaitlistLead`; slug registry in DB; keep the in-memory path for tests only.
- **F2 (Gamma)**: mount validator routes behind the flag for staged testing; Redis edge cache for `/v/[slug]` per PROJECT_STATE.
- **F3 (web)**: `/app/validator` create/generate actions wired; remove the topbar sample claim when the page is fully real.

## 9. Stage G: plans and enforcement

- **G1 (Gamma)**: engine endpoint returning `EntitlementDecision` per feature to the web (closes the `GATING.md` gap); then enable `LEADLOOM_ENTITLEMENTS_ENFORCED` after Kamal decides plans and prices. UI shows LockBadge/GatedButton states from that decision only.

## 10. Stage H: platform admin (later)

- **H1 (Gamma)**: platform-admin record + guard; real tenant/audit reads replace `MOCK_TENANTS`/`MOCK_AUDIT_LOGS`. Until then `/admin` stays closed in production (current honest behavior).

## 11. Stage I: signals, researcher, scraper (backlog)

Mount only after D and E are stable; Playwright concurrency <= 2 with the documented RAM fencing.

## 12. Stage J: hardening and polish (continuous, small)

- **J1**: client-IP passthrough for the per-IP limiter (currently sees the proxy address).
- **J2**: captcha decision for public auth endpoints (currently none).
- **J3**: resolve the 14 skipped engine tests or document why each is skipped.
- **J4**: isolated PG16 suite + migration fixture check in a CI-like script (PHASES.md Phase 5).
- **J5**: full Stage 4 landing build: mega menus per `LANDING.md`, `REFERENCE_MAP.md` from public sources only ("reference product", never named), comparison claims only with sourced facts.

---

## 13. Known accepted limits (documented, not bugs)

- No server-side logout: a copied engine token stays valid up to 12h or until password reset (`STAGES.md` revocation boundary).
- In-memory rate limiters are per-process.
- Resend Free quota is shared with the other dmpilot.org products.

## 14. Parked by the planner, not decided by Kamal

The planner suggested deferring multi-workspace membership, custom per-member permissions, CSV import, DNS inspector, waterfall UI builder modal, upgrade checkout/pricing UI and waitlist storage from the hero CTA. These are suggestions only; Kamal has not ruled on them. Anything requiring provider spend or a real send waits for his explicit go.

- **E5 (web+engine, DONE 2026-11-12)**: per-campaign send-status visibility: campaign cards now show real queued/awaiting-approval/sending/sent/uncertain/failed/reply counts aggregated from outbound_jobs and inbound_replies (see SYNC_FEED 2026-11-12T13:26Z). Remaining in this area: per-recipient job drill-down and delivery-event timeline.
