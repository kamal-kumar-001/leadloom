# Feature gating (lock icons)

Pattern taken from Kamal's DMPilot (site-wide lock plus upgrade prompt, server-side enforcement; recorded from his notes, source not read). Leadloom rules:
- The engine decides. Web code never hard-codes plan checks. The input is the shared `EntitlementDecision` (packages/contracts/src/entitlements.contract.ts) mapped by `apps/web/lib/gate.ts`.
- A UI lock is not enforcement. Every gated engine route must also refuse (`checkFeature`/`checkLimit` already exist; engine reports entitlements `not_enforced` until configured).
- Three states, never mixed: `available`, `locked` (plan or billing, lock icon plus reason), `unavailable` (not built yet, no lock, no upgrade wording).
- No prices, caps or upgrade checkout in the UI until Kamal decides plans. The upgrade link is absent, not faked.
- Use `LockBadge` and `GatedButton` from @leadloom/ui. Locked controls stay focusable, set aria-disabled and show the reason as text.
- Gap: no engine endpoint returns a decision to the web yet. Until one exists, gates receive `null` and show "Plan check not available yet" for gated actions only where the feature is actually gated server-side. Do not add gates to pages that have no server-side check.
