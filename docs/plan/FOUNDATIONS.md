# Foundations: roles, dashboards, entitlements, billing, email, and what is still missing

Source: Kamal's 6:48 PM voice direction: separate admin and user dashboards, pricing, feature access and limits managed centrally, modular so new features do not mean reworking the app, reuse his existing components, app emails through a transactional provider, no outreach or paid sends without his approval.

Scope note: the aim is modularity and config-driven plans, prices and limits. A routine pricing or feature change is a data edit. A new kind of feature still needs code and a rebuild.

## Roles (two separate layers)
- Tenant roles (exist today, `users.role`): `admin`, `member`, `read_only`. They apply inside one workspace.
- Platform roles (do NOT exist in the schema yet): `platform_admin`, `platform_support`. They are Kamal's operator view across tenants. Whether he wants a super-admin dashboard for himself or an admin role inside each tenant is not confirmed. The plan assumes both: tenant admin dashboard (members, usage, keys) and a platform admin dashboard (tenants, plans, audit). Confirm before the platform layer is built.
- Rule: roles, workspace and user id come only from the engine's own tables. A token or browser never supplies them (see the NextAuth bridge: it proves a verified email only).

## Dashboards
- User dashboard (`/app/*`): tables, connectors, mailboxes, campaigns, validator, usage and plan view.
- Admin dashboards: tenant admin (`/app/settings/*`) and platform admin (`/admin/*`, gated by platform role, separate layout).
- UI never decides entitlements. It renders `EntitlementDecision` from the server.

## Entitlements and limits (built, `packages/contracts/src/entitlements.contract.ts`, `apps/engine/src/modules/entitlements`)
- Plans are data (`PlanDefinition`): features on/off, numeric limits (null = unlimited, missing = deny). Prices are null until Kamal decides them. They are never shown as real prices.
- `EntitlementService.checkFeature` and `checkLimit` are deny-by-default (no plan, inactive billing, missing keys).
- All teams call the service instead of hard-coding plan checks. Beta: gate waterfall dispatch and enrichment credits. Gamma: gate mailbox connect and sending. Alpha: show the decision, never compute it.
- Not built yet: DB tables for plan assignment and usage counters, the usage metering writers, routes that expose decisions, admin editing of plans.

## Billing boundaries
- Billing provider is not chosen and nothing is integrated. The engine only needs `WorkspacePlanRef {planId, status}`. A future billing webhook writes that row.
- No payment, subscription or paid-send action without Kamal's explicit approval.

## Transactional email (built, `apps/engine/src/modules/email/transactional.ts`)
- App mail only: verification, password reset, invites, billing notices. One recipient, fixed kinds, header-injection rejection, per-minute cap. Default off.
- Provider: Resend over HTTPS, using only `LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED`, `LEADLOOM_RESEND_API_KEY`, `LEADLOOM_EMAIL_FROM`. No default sender.
- Kamal allowed using the BakeryPOS Resend key. That key has not been retrieved or configured. Before any real send: confirm the key's allowed sending domain, use a separate from-address that cannot disturb BakeryPOS mail, and ground recipient, content and purpose. Secrets go through the vault, never into code, chat or docs.
- Outreach email is a different path (`modules/outbound`), separately gated, and not approved.

## Missing foundations (build order)
1. Tenant isolation proof: every query scoped by workspace id, plus cross-tenant tests (no RLS yet).
2. Audit log table and writer (who did what, when, from where), including admin and platform actions.
3. Plan assignment and usage tables; metering at enqueue points.
4. User and workspace provisioning for NextAuth sign-in (no auto-provision today: an unknown email gets 401), invites, and email verification.
5. Platform role storage and the admin API.
6. Secrets and settings admin screens backed by the vault.
7. Rate limiting and abuse controls on public endpoints.
8. Observability: structured logs, request ids, error reporting without payloads.
9. Backups and the update.sh fresh-install path (see MIGRATIONS.md).
10. Data export and deletion per tenant.

## Built since: entitlement enforcement (default-off)
- Migration `20261112_workspace_entitlements` (additive): `workspace_plans` (which plan, billing status) and `usage_counters`. No row means no plan, which means deny.
- `PrismaEntitlementStore` implements the plan and usage ports, with atomic increment. Routes `/waterfall/*`, `/validator/experiments`, `/outbound/jobs` check the server-side gate when `LEADLOOM_ENTITLEMENTS_ENFORCED=true`. Without the flag nothing changes (`/health` shows `routes.entitlements`).
- Not yet: nothing writes `workspace_plans` rows (needs provisioning), nothing calls `record()` (needs real metered actions), limit gates are not on routes yet.

## Platform-admin boundary (design, not built; no role is assigned to anyone)
- Separate from tenant roles: a `platform_admins` table keyed by user id, with its own token audience (`leadloom-platform`) so a tenant token can never carry it, and a separate route prefix `/platform/*` with its own layout in the web app.
- Grants happen out of band (a one-off script run by the owner), never through a tenant API. Every platform action writes an audit-log row. Impersonation, if ever added, is read-only and logged.
- This follows the owner's super-admin pattern in his other products; it is not authority to grant platform privileges to any user.

## Built since: first sign-in provisioning and audit log (default-off)
- Migration `20261113_audit_log` (append-only table). `POST /auth/provision` mounts only with `LEADLOOM_SELF_SIGNUP_ENABLED=true` plus the NextAuth bridge. It is authenticated only by a bridge token (verified email). The body can carry a display name and nothing else: a new user always gets a brand-new workspace and is admin of that workspace alone; an existing user is returned unchanged. Workspace and role cannot be chosen or injected. Workspace, user and audit row are one transaction, and concurrent first sign-ins converge on one account (10-way race tested on real PG16: one workspace, one admin, one audit row, no orphan workspaces).
- No plan is assigned on signup, so entitlement gates deny until an owner or billing flow assigns one. Plan names (`free`, `pro`) and caps in `default-plans.ts` are development fixtures, not approved pricing or limits.
- Legacy: `workspaces.plan` (default "free") predates entitlements and is NOT authoritative. Enforcement reads `workspace_plans` only. `workspaces.is_active` is not checked yet.
- Still missing: invites (joining an existing workspace), email verification mail, limit gates on routes, metering, plan assignment, rate limiting on `/auth/provision`, audit rows for other actions. Feature gating is partial, not complete.
