# Feature gating (lock icons)

Pattern taken from Kamal's DMPilot (site-wide lock plus upgrade prompt, server-side enforcement; recorded from his notes, source not read). Leadloom rules:
- The engine decides. Web code never hard-codes plan checks. The input is the shared `EntitlementDecision` (packages/contracts/src/entitlements.contract.ts) mapped by `apps/web/lib/gate.ts`.
- A UI lock is not enforcement. Every gated engine route must also refuse (`checkFeature`/`checkLimit` already exist; engine reports entitlements `not_enforced` until configured).
- Three states, never mixed: `available`, `locked` (plan or billing, lock icon plus reason), `unavailable` (not built yet, no lock, no upgrade wording).
- No prices, caps or upgrade checkout in the UI until Kamal decides plans. The upgrade link is absent, not faked.
- Use `LockBadge` and `GatedButton` from @leadloom/ui. Locked controls stay focusable, set aria-disabled and show the reason as text.
- Decision endpoint (added 2026-11-20): GET /entitlements/decision?feature=<key>[&limit=<key>&requested=N] returns the session workspace's EntitlementDecision(s), keys validated against the shared contract; default-off (404) when the entitlement service is not mounted, exactly like the enforcement it reports on. Web reads it only through lib/engine-client.ts fetchEntitlementDecision. When the route is absent (unconfigured), enforcement is off server-side too, so the UI must render the normal control, never a fake lock. First consumer: /app/validator generate button (feature 'validator', which has a server-side check). Do not add gates to pages that have no server-side check.
