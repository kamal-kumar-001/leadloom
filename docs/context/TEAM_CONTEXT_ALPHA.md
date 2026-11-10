# Team Alpha Context Capsule — Experience, 3D Growth & Workspace UI

* **Team Name:** Team Alpha (Frontend & Visual Experience)
* **Designated Skills:** `[Recommended Skill: landing-page-design]` `[Recommended Skill: apple-design]` `[Recommended Skill: animate]` `[Recommended Skill: animation-performance]` `[Recommended Skill: emil-design-eng]` `[Recommended Skill: frontend-patterns]`
* **Primary Scope:** Landing page, 3D WebGL Living Loom Core, high-density Loom Virtual Grid, Idea Validator micro-pages (`/v/[slug]`), and campaign composer drawer.

---

## 1. Owned Physical Directories (Strict Write Permissions)
- `apps/web/**`
- `packages/ui/**`
- `packages/webgl-scenes/**`

> **Forbidden Pattern:** Team Alpha agents are strictly forbidden from modifying `apps/engine/**`, `workers/**`, or `packages/database/**`. Any required API or schema modification must be proposed as a pull request against `packages/contracts`.

---

## 2. Upstream Contract Imports (`packages/contracts`)
- `ColumnDefinition`, `RowRecord`, `TableMetadata` from `./grid.contract`
- `WaterfallCellPayload`, `PreFlightEstimateResponse` from `./waterfall.contract`
- `ValidationScorecardResponse`, `SmokePageConfig` from `./validation.contract`
- `MailboxHealthStatus`, `CampaignStep` from `./outbound.contract`
- Deterministic mock generators from `./mocks` (Allows 100% offline UI development)

---

## 3. Active Task Queue
1. **Interactive 3D Loom Core:** Implement `@react-three/fiber` canvas with cursor tracking and CTA hover lighting morph (Indigo $\leftrightarrow$ Emerald Matrix). Enforce $< 500\text{KB}$ asset limit.
2. **Smooth Inertial Scroll:** Integrate `@studio-freight/lenis` synced with GSAP ScrollTrigger camera paths.
3. **Loom Virtual Grid:** Virtualize 50,000 rows with `@tanstack/react-virtual` and Zustand normalized slices at 60fps.
4. **Idea Validator Micro-Page (`/v/[slug]`):** Implement high-converting waitlist capture with 2-question pain survey modal.

---

## 4. Context Checkpoint Protocol
Before writing code:
1. Read the last 20 lines of `docs/context/SYNC_FEED.md`.
2. Inspect `docs/adr/003-3d-webgl-performance-budget.md` and `docs/adr/002-virtual-grid-state.md`.
3. Load designated skill before editing component files.
