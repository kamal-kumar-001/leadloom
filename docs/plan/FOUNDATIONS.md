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
