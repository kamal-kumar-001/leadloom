# LeadLoom — UI/UX Research & Comprehensive Design Specification

**Product Name:** **LeadLoom**  
**Document Version:** 2.1 (Awwwards-Grade Interactive 3D & Pre-Product Validation Experience)  
**Author:** Principal UI/UX Architect & Design Engineer  
**Tech Stack:** Next.js 14 (App Router), Tailwind CSS v3.4+, Radix UI / Shadcn Primitives, `@tanstack/react-virtual`, `@react-three/fiber`, `@react-three/drei`, Three.js, `@studio-freight/lenis`, GSAP / Framer Motion, Sonner.  
**Design Philosophy:** Linear/Supabase Industrial Minimalism meets Apple-grade tactile physics and kinetic 3D WebGL weaving telemetry ("The Living Loom Metaphor").

---

## 1. UX Research & Competitive Friction Analysis `[Recommended Skill: emil-design-eng]`

Before engineering LeadLoom's interfaces, we audited four market incumbents (names withheld). While commercially successful, their interfaces impose significant cognitive drag on RevOps teams and growth practitioners.

### 1.1 Competitor Failure Modes vs. LeadLoom Solutions

| UX Bottleneck | Incumbent Failure Mode (incumbents) | LeadLoom Design Solution |
| :--- | :--- | :--- |
| **Horizontal Scroll Hell** | Adding 4 enrichment providers generates 30+ wide, un-collapsible columns. Users waste 40% of their session panning across screens. | **Collapsible Single-Column Bundles (`<WaterfallCell/>`):** An entire 3-tier cascade occupies a single $220\text{px}$ column. Hovering or clicking reveals execution breadcrumbs and provider attribution inline. |
| **Credit Anxiety & Blind API Burn** | Clicking "Run Batch" triggers irreversible credit consumption without showing provider pricing or short-circuit rules. | **Pre-Flight Telemetry Dock (`<PreFlightBar/>`):** A fixed glassmorphic dock displays: *Estimated Wholesale Cost ($4.12 via BYOK) • 3 Tiers • 2m 10s run time • Max cost ceiling*. |
| **Context Switching Fragmentation** | Teams enrich contacts in a spreadsheet, export a CSV, upload to an email sequencer, and lose signal binding. | **Split-Screen "Loom View":** Right-side composer drawer docked alongside the active grid. Selecting any row instantly renders the personalized email draft with live variable tokens. |
| **Black-Box Failure Ambiguity** | When an email lookup fails, cells show a static red badge `Failed` without explaining whether the provider timed out, hit a rate limit, or returned a catch-all. | **Diagnostic Micro-Trace Pills:** Hovering any cell displays an instant trace: `1. Apollo (404) → 2. Hunter (Catch-all skipped) → 3. Dropcontact (Verified ✓ - 142ms)`. |
| **Visual Fatigue & Bloat** | Chaotic neon badges, noisy multi-color gradients, and nested sidebars distract during long 6-hour prospect research sessions. | **Dark-First Monochromatic Industrial System:** Strict slate palette, JetBrains Mono telemetry, crisp 1px borders, and full keyboard-first traversal (`Cmd+K`, arrow keys, vim bindings). |
| **Premature Building Waste** | Founders spend 3 months building a full MVP without validating whether customers have budget or acute pain. | **One-Prompt Idea Validator Canvas:** A dedicated workspace view that spins up a smoke-test micro-page (`/v/[slug]`) and displays an automated Go / No-Go Validation Scorecard. |

---

## 2. Design System Tokens & Tailwind CSS Specification `[Recommended Skill: figma-designer]` `[Recommended Skill: emil-design-eng]`

### 2.1 Color Tokens & Contrast Matrix (Dark Mode Primary, High-Contrast Light Mode)
Designed for drop-in inclusion in `tailwind.config.ts`:

```typescript
// tailwind.config.ts snippet
export const themeColors = {
  canvas: {
    DEFAULT: '#090A0F', // Main workspace canvas
    surface: '#11131C', // Card panels, table headers, drawers
    elevated: '#181B27', // Modals, popovers, dropdown menus
    subtle: '#222638',   // Hover row backgrounds
  },
  border: {
    subtle: '#1E2333',   // 1px table cell borders
    muted: '#2A3047',    // Card outlines and dividers
    focus: '#6366F1',    // Cell selection ring (Indigo 500)
  },
  brand: {
    loom: '#6366F1',     // Primary Brand Indigo
    loomGlow: 'rgba(99, 102, 241, 0.15)',
    weave: '#A855F7',    // AI Researcher Nodes (Purple 500)
    matrix: '#10B981',   // Emerald Terminal Matrix for Self-Hosted
  },
  signal: {
    verified: '#10B981', // Deliverable email / Active signal (Emerald 500)
    catchall: '#F59E0B', // Risky / Catch-all warning (Amber 500)
    failed: '#EF4444',   // Bounced / Invalid / Exhausted (Rose 500)
    throttled: '#EC4899',// Rate-limit 429 paused (Pink 500)
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
    mono: '#E2E8F0',
  }
};
```

### 2.2 Typography Scale
- **Headings & Display:** `Inter` or `Plus Jakarta Sans` (`font-sans`), tight letter-spacing (`tracking-tight`, `-0.02em`).
- **Data Table Cells:** `13px` font size, `line-height: 18px` for maximum information density without visual crowding.
- **Monospace Telemetry:** `JetBrains Mono` (`font-mono`). Used strictly for:
  - Latency badges (`142ms`)
  - Wholesale cost tags (`$0.003`)
  - Email addresses (`alex@vercel.com`)
  - HTTP status codes (`200 OK`, `429 Too Many Requests`)
  - JSON property paths (`lead.company.tech_stack[0]`)

### 2.3 Spacing & Radius Tokens
- **Spacing Scale:** Standard 4px grid (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Corner Radii:**
  - `rounded-sm`: `3px` (Table cell badges, telemetry pills)
  - `rounded-md`: `6px` (Buttons, inputs, dropdown items)
  - `rounded-lg`: `10px` (Modals, cards, slide-over drawers)
  - `rounded-full`: Pill badges (`Verified`, `Catch-all`, `Scorecard Verdict`)

---

## 3. Core Application Wireframes & Component Specs `[Recommended Skill: frontend-patterns]` `[Recommended Skill: apple-design]`

### 3.1 The Loom Canvas Workspace Wireframe
```
+-------------------------------------------------------------------------------------------------------------------+
| [🧵 LeadLoom]  Workspace / Q4 Series-A Rust & Go Targets v      [⚡ BYOK Vault: 4 Connected]   [Run Waterfall ▶]   |
+----+--------------------------------------------------------------------------------+-----------------------------+
|    | [🔍 Filter: 1,420 Rows] [Group by Stack] [Sort] [+ Add Signal] [+ Waterfall]   |  ✉️ LIVE SEQUENCE COMPOSER  |
| 📊 |--------------------------------------------------------------------------------|  [Step 1: Day 1] [Step 2]   |
| T  | #   | Company    | Domain       | 🔥 Trigger Signal  | 🌊 Email Waterfall (3)  |-----------------------------|
| A  |-----|------------|--------------|-------------------|-------------------------|  To: alex@vercel.com        |
| B  | 1   | Vercel     | vercel.com   | [GH] +140 stars/wk| ✅ alex@vercel.com [HU] |  From: alex-outreach@loom   |
| L  | 2   | Supabase   | supabase.com | [Job] +3 Rust Eng | ✅ paul@supabase.co[AP] |                             |
| E  | 3   | Railway    | railway.app  | [Web] Pricing chg | ⚡ Hunter (140ms)...    |  "Hey Alex, noticed         |
|    | 4   | Linear     | linear.app   | [News] Series B   | ⚠️ karri@linear.app[CA] |  Vercel's repo passed       |
| 🌊 | 5   | Modal      | modal.com    | [Job] ML Infra Dir| ❌ Exhausted (3/3 tried)|  140 stars this week..."    |
| D  |--------------------------------------------------------------------------------|                             |
| A  |                                                                                |  [AI Signal: {{repo_stars}}]|
| G  |          +------------------------------------------------------------+        |  Confidence: 98%            |
|    |          | ☑ 240 Rows Selected │ Est. BYOK Cost: $0.96 │ Time: 45s    |        |                             |
| 📬 |          | [ ▶ Run Selected Rows ]    [ ✉️ Push to Active Sequence ]  |        |  [Approve & Schedule 240]   |
|    +----------+------------------------------------------------------------+--------+-----------------------------+
```

### 3.2 Pre-Product Idea Validator Workspace ("Smoke-Test Radar") `[Recommended Skill: landing-page-design]`
```
+-------------------------------------------------------------------------------------------------------------------+
| [🧵 LeadLoom]  Validation Hub / "Kubernetes Cloud Cost-Cutter"   [Active /v/k8s-cutter]   [Export Waitlist (18) 📥] |
+-------------------------------------------------------------------------------------------------------------------+
|  [💡 HYPOTHESIS]: "Automated Kubernetes cost-cutter for Series A startups"                                         |
|  [🎯 DERIVED ICP]: VP Eng, Head of DevOps at 20-100 employee startups running AWS EKS                             |
+-----------------------------------------------------+-------------------------------------------------------------+
|  📊 AUTOMATED VALIDATION SCORECARD                  |  🌐 LIVE SMOKE-TEST MICRO-PAGE (/v/k8s-cutter)              |
|                                                     |  [Status: Online • 240 Visitors • 18 Signups]              |
|  VERDICT: 🔥 HIGH PULL — BUILD NOW (Score: 84/100)  |-------------------------------------------------------------|
|                                                     |  Cut 40% of your idle K8s cloud bill in 10 minutes.         |
|  • Micro-Page Conversion:  7.5% (Benchmark: 8.0%)   |  [Request Early Access] -> Opens 2-Question Survey          |
|  • Outreach Reply Rate:    8.2% (Benchmark: 5.0%)   |                                                             |
|  • Positive Problem Fit:   62%  (Benchmark: 40%)    |  📝 RECENT SURVEY RESPONSES:                                |
|  • Total Waitlist Leads:   18 Qualified Accounts    |  1. "Our Datadog & EKS bills are out of control" (CTO, Series A)
|                                                     |  2. "Need automated cluster right-sizing" (DevOps Lead)     |
|  [⚡ Launch Outbound Batch 2 (+200 leads)]          |  [Edit Micro-Page Copy]    [Connect Custom Domain]          |
+-----------------------------------------------------+-------------------------------------------------------------+
```

---

## 4. Signature Component Implementations & Interactions `[Recommended Skill: emil-design-eng]` `[Recommended Skill: animate]`

### 4.1 Signature Component 1: `<LoomVirtualGrid/>`
- **Virtualization Core:** Uses `@tanstack/react-virtual` with dynamic overscan of 5 rows above/below viewport.
- **Fixed Cell Dimensions:** Row height fixed at $38\text{px}$ in Compact view, $48\text{px}$ in Standard view to eliminate layout shifts.
- **Sticky Columns:** Checkbox column, Row Number, and Primary Domain stick to the left viewport boundary during horizontal scrolling.
- **Keyboard Navigation Matrix:**
  - `Arrow Keys`: Move active cell selection ring (`outline: 2px solid #6366F1`).
  - `Space`: Open cell **Thread Inspector** modal.
  - `Enter`: Begin inline cell text edit.
  - `Cmd+A`: Select all visible rows in current filter.
  - `Cmd+R`: Execute waterfall on selected rows.

### 4.2 Signature Component 2: `<WaterfallCell/>` (Collapsible Cascade Node)
Renders a compact, high-density view of multi-tier enrichment:
- **Default State:** Displays the winning verified email, a green deliverability dot (`#10B981`), and a tiny mono vendor badge (`[HU]` = Hunter, `[AP]` = Apollo, `[DC]` = Dropcontact).
- **Execution State:** Animated pulse indicator with the currently executing provider's icon and a live timer (`Apollo (120ms)`).
- **Hover Micro-Trace Popover:** Floating glass card revealing:
  1. `Tier 1: Apollo BYOK` $\rightarrow$ `HTTP 404 Not Found` ($82\text{ms}$)
  2. `Tier 2: Hunter.io` $\rightarrow$ `HTTP 200 Deliverable` ($142\text{ms}$) — **Early Exit Triggered**
  3. `Tier 3: Dropcontact` $\rightarrow$ `Skipped (Preserved $0.03)`
- **Click Action:** Expands the column bundle into individual provider sub-columns for deep debugging.

### 4.3 Signature Component 3: `<PreFlightBar/>` (Credit Anxiety Eliminator)
A fixed, floating action dock rendered at the bottom center of the screen (`fixed bottom-6 left-1/2 -translate-x-1/2 z-50`):
- **Glassmorphism:** `bg-canvas-surface/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full px-6 py-3`.
- **Live Counters:**
  - Selected Row Count (`240 rows`)
  - Estimated Wholesale Cost (`$0.96` computed from active provider rates)
  - Estimated Duration (`45 seconds` based on queue concurrency)
  - Short-Circuit Guarantee Badge: `Shield Checkmark: Zero Unnecessary API Calls`.
- **Action Buttons:**
  - `[▶ Run Waterfall]` (Indigo CTA button with keyboard shortcut hint `⌘↵`)
  - `[✉️ Push to Campaign]` (Secondary outline button)

### 4.4 Signature Component 4: `<ThreadInspector/>` (Scraper & AI Debugger)
When clicking an AI prompt or web scrape cell, a full-height slide-over modal opens:
- **Left Pane (50% width):** Clean Readability-extracted Markdown view of the target website's text, showing exactly what the headless Playwright worker scraped.
- **Right Pane (50% width):**
  - Prompt Template Editor with syntax-highlighted `{{column_variable}}` pills.
  - Model Selector dropdown: `Local Ollama (Llama 3.1 8B)`, `Gemini 1.5 Flash`, `DeepSeek-V3`, `GPT-4o-mini`, `Claude 3.5 Haiku`.
  - JSON Schema Validator toggle: Enforces strict structured output.
  - `[Test on This Row]` button with instantaneous token cost and execution latency feedback.

### 4.5 Signature Component 5: `<ValidationRadarCard/>` (Go / No-Go Scorecard) `[Recommended Skill: landing-page-design]`
- **Verdict Gauge:** Semi-circular SVG gauge displaying score from $0\text{ to }100$ with color-coded zones: Red ($0\text{–}44$), Amber ($45\text{–}79$), Emerald ($80\text{–}100$).
- **Sub-Metrics Breakdown:**
  - Micro-Page Visitors vs. Conversions (Conversion Rate %)
  - Sequence Dispatches vs. Replies (Reply Rate %)
  - LLM Sentiment Classification of replies (`"Yes, this is our #1 headache"` = Positive Problem Fit).
- **One-Click Action:** `[Promote to Full GTM Project]` (converts waitlist leads directly into an active campaign).

---

## 5. Comprehensive Edge-Case UX States `[Recommended Skill: break-ui]` `[Recommended Skill: ask-sonner]`

### 5.1 Empty State: The Zero-Friction Onboarding Canvas
When a user creates a new table or signs up:
- **Anti-Pattern Avoided:** Never show an empty, sterile grid with zero data.
- **LeadLoom Pattern:** Render an interactive hero banner inside the table:
  - Headline: *"Start by weaving intent signals into pipeline."*
  - Action Button 1: **`[⚡ Populate 10 Live SaaS Accounts (Free Demo)]`** — Instantly loads 10 real companies (e.g., Vercel, Supabase, Linear) with pre-configured mock keys so the user can test the waterfall within 5 seconds.
  - Action Button 2: **`[💡 Test a New Startup Idea (Validator Mode)]`** — One-prompt smoke-test generator.
  - Action Button 3: **`[📁 Upload CSV File]`** with drag-and-drop zone.

### 5.2 Partial Waterfall Failure States
- **Provider Quota Depleted:** Cell displays `⚠️ Apollo (Quota 0) → Hunter (Active)`. An inline badge alerts the user to update their Apollo API key in the Vault.
- **Catch-All Domain Detected:** Cell displays an Amber warning badge: `⚠️ catch-all domain: alex@stripe.com (Verification Score: 65%)`.
- **Exhausted State:** When all configured tiers fail to find a deliverable email, the cell displays `❌ Not Found (3/3 tried)`. Clicking opens a drawer allowing one-click retry with a newly configured provider.

### 5.3 External API Rate-Limit Throttling Banners
When a provider returns HTTP 429:
- A non-intrusive Sonner toast appears at the top right:  
  `[Throttled] Hunter.io returned 429 Too Many Requests. Queue paused; resuming in 38s.`
- The table header displays a pulsing amber dot on the affected provider icon with a countdown timer.
- Ongoing jobs in other providers continue running uninterrupted.

### 5.4 Malformed CSV Import Recovery Flow
When users upload messy or malformed CSV files:
1. **Interactive Column Heuristic Modal:**
   - Detects columns with Levenshtein fuzzy matching (`Work E-mail` $\rightarrow$ `email`, `Website URL` $\rightarrow$ `domain`).
   - Displays a confidence pill for each mapping (`98% Match`, `Manual Review Needed`).
2. **Syntax Fixer Step:**
   - Cleans domain URLs: strips `https://`, `http://`, `www.`, and trailing slashes automatically.
   - Flags duplicate rows with a one-click **`[Merge & Deduplicate]`** button.
3. **Chunked Background Ingestion:**
   - Large CSVs ($50,000+$ rows) display a smooth progress bar with cancellation support, streaming rows directly into PostgreSQL via Web Workers without freezing the UI.

---

## 6. Ultra-Modern Interactive 3D & Motion Landing Page (`useleadloom.com`) `[Recommended Skill: landing-page-design]` `[Recommended Skill: apple-design]` `[Recommended Skill: animate]` `[Recommended Skill: animation-performance]`

This specification elevates LeadLoom from a conventional SaaS marketing page into an **Awwwards / Apple / Linear-grade interactive 3D WebGL experience**, engineered to maintain a locked **60 FPS** on mid-range laptops and mobile devices while incurring **$0 in extra hosting overhead**.

---

### 6.1 Interactive 3D Hero: "The Living Loom Core" (`<LivingLoomCanvas/>`) `[Recommended Skill: animate]` `[Recommended Skill: apple-design]`

```
+---------------------------------------------------------------------------------------------------+
| [🧵 LeadLoom]      Architecture      Waterfall Engine      Idea Validator      Docs   [★ GH 3.8k] |
|                                                                    [Self-Host Docs] [Start Free →]|
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|               [ 🟢 100% OPEN-CORE • BRING YOUR OWN KEYS • ZERO DATA MARKUP ]                      |
|                                                                                                   |
|           Weave buying signals into qualified revenue.                                            |
|           Stop paying a 500% middleman tax on API credits.                                        |
|                                                                                                   |
|      [ 🚀 Launch Free Cloud Trial ]       [ $ docker compose up -d leadloom 📋 ]                  |
|                                                                                                   |
|   +-------------------------------------------------------------------------------------------+   |
|   │ 3D WEBGL FOCAL STAGE: "THE LIVING LOOM CORE" (Three.js / React Three Fiber)               │   │
|   │                                                                                           │   │
|   │         * GitHub Stargazers (Chaotic Particles)                                           │   │
|   │             \                                                                             │   │
|   │              \     [ Glowing Geometric Loom Core ] <=== (Tracks Cursor via lerp)          │   │
|   │               \   /                                                                       │   │
|   │   Job Signals ===> [ Fiber-Optic Weave Funnel ]                                           │   │
|   │                           │                                                               │   │
|   │                           ▼ (Braids into Single Emerald Thread)                           │   │
|   │                   [ 2D Virtual Data Grid ]                                                │   │
|   +-------------------------------------------------------------------------------------------+   │
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

#### 1. Visual Metaphor & Geometric Architecture
- **The Core Mesh:** A multifaceted cybernetic polyhedron ("The Loom Core") suspended in 3D WebGL space.
- **Fiber-Optic Data Threads:** 64 instanced splines (curves) representing incoming buying signals (GitHub stars, job posts, funding announcements) feeding into the core.
- **Shader Material:** Custom GLSL fragment shader with an iridescent rim-fresnel glow and an emissive inner pulse mapped to the heartbeat of simulated queue events.

#### 2. Cursor Reactivity & Magnetic Physics
- **Head/Eye Tracking (`lerp` Smoothing):**
  - As the visitor moves their pointer, the 3D Loom Core tracks `(clientX, clientY)` with dampened spherical interpolation:
    $$\theta_{x} = \text{lerp}(\theta_{x}, \, \text{targetX} \times 0.35, \, 0.08)$$
    $$\theta_{y} = \text{lerp}(\theta_{y}, \, \text{targetY} \times 0.35, \, 0.08)$$
  - Data threads physically curve and magnetize toward the cursor position within a 150px proximity radius.

#### 3. CTA Hover Micro-States (Lighting State Morph)
- When the user hovers over **`[Launch Free Cloud Trial]`**:
  - The 3D scene lighting shifts to **Electric Indigo & Soft Violet** (`#6366F1` / `#A855F7`), with energetic particle ribbons orbiting the core.
- When the user hovers over **`[$ docker compose up -d leadloom]`**:
  - The 3D core instantly transitions into an **Emerald Terminal Matrix** (`#10B981`), wireframes become visible, and ASCII-style data sparks shoot along the fiber splines.

---

### 6.2 Smooth Inertial Scroll & Choreographed Scrollytelling `[Recommended Skill: animate]` `[Recommended Skill: apple-design]`

Smooth inertial scrolling is managed via **Lenis (`@studio-freight/lenis`)** synced with **GSAP ScrollTrigger** / **Framer Motion**:

```
[Scroll: 0% - 25%]  Hero Stage: Chaotic 3D signals float freely in space around the cursor.
         │
         ▼
[Scroll: 25% - 60%] The Waterfall: 3D signals get sucked into the central Loom vortex,
                    braiding into a single glowing emerald thread that physically plugs
                    into the top of the 2D Virtual Data Grid.
         │
         ▼
[Scroll: 60% - 85%] Idea Validator: Holographic 3D wireframe of a product morphs from a
                    rough blueprint sketch into validated revenue bars and scorecard gauges.
         │
         ▼
[Scroll: 85% - 100%] Infrastructure: The 3D camera pulls back into an orthographic view of
                    a self-contained, low-cost Docker container humming with activity.
```

#### Implementation Code Pattern (Lenis + GSAP ScrollTrigger)
```typescript
// apps/web/components/marketing/smooth-scroll-provider.tsx
'use client';
import { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Respect user accessibility preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  return <>{children}</>;
}
```

---

### 6.3 Interactive Micro-Physics: Magnetic Buttons & Spotlight Cards `[Recommended Skill: emil-design-eng]`

#### 1. Magnetic CTA Buttons (`<MagneticButton/>`)
Primary conversion CTAs subtly attract toward the cursor when hovering within a $20\text{px}$ perimeter:
- Uses Framer Motion spring physics (`damping: 15, stiffness: 150, mass: 0.1`).
- Translates up to $8\text{px}$ along both X and Y axes, giving a tactile "snapping" feel inspired by Apple visionOS buttons.

#### 2. Zero-Re-Render Spotlight Bento Cards (`<SpotlightCard/>`)
Bento grid cards feature a dynamic radial glow that traces the cursor without causing React re-renders:
- An event listener on the container updates native CSS custom properties directly on the element DOM node:
  ```typescript
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };
  ```
- **CSS Shader Layer:**
  ```css
  .spotlight-card::before {
    content: '';
    position: absolute;
    inset: -1px;
    background: radial-gradient(
      400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
      rgba(99, 102, 241, 0.25),
      transparent 80%
    );
    border-radius: inherit;
    pointer-events: none;
    z-index: 1;
  }
  ```

---

### 6.4 Strict 3D WebGL Performance & FinOps Guardrails `[Recommended Skill: animation-performance]` `[Recommended Skill: debug-optimize-lcp]`

To guarantee that the 3D visual upgrades **cost $0 extra in infrastructure** and achieve a **Lighthouse Score $\ge 95$ (LCP $< 1.2\text{s}$)**:

1. **Lazy WebGL Hydration (`<Suspense>` + CSS Fallback):**
   - On initial page load, the browser renders an ultra-lightweight ($< 2\text{KB}$ CSS/SVG ambient gradient) fallback.
   - The `@react-three/fiber` canvas is dynamically imported via `next/dynamic` with `ssr: false`:
     ```typescript
     const LivingLoomCanvas = dynamic(
       () => import('./living-loom-canvas').then((m) => m.LivingLoomCanvas),
       { ssr: false, loading: () => <AmbientLoomFallback /> }
     );
     ```
   - Three.js bundles are fetched strictly after First Contentful Paint (FCP).

2. **Draco-Compressed Asset Budget ($< 500\text{KB}$ Total):**
   - 3D models use Google Draco geometry compression (`.glb` size strictly $\le 380\text{KB}$).
   - Textures are restricted to $1024 \times 1024$ WebP or KTX2 basis universal format ($< 80\text{KB}$).
   - Assets are served via Cloudflare R2 / public static CDN with `Cache-Control: public, max-age=31536000, immutable`.

3. **Graceful Downgrade Matrix (`detect-gpu` & Battery Saver):**
   - **Reduced Motion:** If `prefers-reduced-motion` is detected, the 3D canvas is disabled entirely, replacing it with an elegant static SVG thread diagram.
   - **Low-Tier Mobile GPUs:** If Tier $\le 1$ GPU or low power mode is detected via `detect-gpu`, render loop drops from `demand` to a static CSS canvas, protecting user battery life.
   - **Render on Demand:** When the canvas is stationary (no mouse movement or scroll event), Three.js `frameloop="demand"` halts WebGL rendering to preserve GPU cycles.

---

### 6.5 Full Landing Page Section Blueprint

#### Section 1: Hero Section (Above the Fold) `[Recommended Skill: landing-page-design]`
- **Eyebrow Badge:** `🧵 Open-Core Signal Engine • Apache 2.0 / MIT Licensed`
- **H1 Headline:** **Weave buying signals into qualified revenue. Stop paying middleman markups on data.**
- **Subheadline:** The self-hostable alternative to hosted GTM platforms. Connect your own Apollo, Hunter, and OpenAI keys to enrich leads, validate startup hypotheses, and sequence cold email at pure wholesale API cost.
- **Magnetic CTAs:**
  - `[ Launch Free Cloud Trial ]` (Indigo Glow, Magnetic 20px radius).
  - `$ docker compose up -d leadloom` (Monospace 1-click copy with Sonner toast).
- **Interactive Focal Visual:** `<LivingLoomCanvas/>` with cursor-reactive 3D Loom Core & fiber threads.

#### Section 2: Social Proof & OSS Trust Bar
- **Proof:** `3.8k+ GitHub Stars`, `100% Self-Hostable`, `Docker Single-Command Deploy`.
- **Logos:** Vercel, Supabase, Railway, Resend, Docker, PostHog.

#### Section 3: "Validate Before You Build" (Idea Validator Showcase) `[Recommended Skill: landing-page-design]`
- **Headline:** **Have a new product idea? Validate demand in 30 minutes before writing code.**
- **Interactive Component:**
  - Enter a sample startup idea: *"Automated SOC2 compliance auditor for fintechs."*
  - Watch the preview live-generate: ICP Criteria $\rightarrow$ `/v/soc2-auditor` smoke-test page $\rightarrow$ Founder research sequence $\rightarrow$ Live Go/No-Go Radar Gauge.

#### Section 4: The "Markup Exposed" Interactive Calculator `[Recommended Skill: landing-page-design]`
- **Interactive Range Slider:** $1,000$ to $100,000$ monthly contacts.
- **Card A (incumbents):** `$1,200/mo` with predatory credit markups.
- **Card B (LeadLoom Self-Hosted):** `$74/mo` direct API cost (**Save $13,512/year**).

#### Section 5: The 3-Pillar Asymmetric Bento Grid `[Recommended Skill: apple-design]`
- **Bento Card 1:** Real-Time Intent Signal Listeners (GitHub stars, hiring events, tech stack changes).
- **Bento Card 2:** DAG Adaptive Waterfall Engine (Early-exit short-circuiting).
- **Bento Card 3:** Integrated Multi-Inbox Sequencer with SPF/DKIM health gauges.

#### Section 6: Built for Engineers (Docker & Architecture Transparency)
- Interactive tabbed viewer: `docker-compose.yml`, `CustomProvider.ts`, `Security.md`.

#### Section 7: Transparent Pricing Matrix
- **Community Edition:** $0 Forever (Self-hosted, unlimited rows, Docker).
- **Cloud Pro:** $49 / month (Managed cloud, residential proxy pool, warmup network).

#### Section 8: Final High-Conversion CTA Block
- **Headline:** **Ready to take back your GTM margins?**
- **Action:** `[ Deploy Cloud Workspace Free ]` and `[ Star on GitHub ★ ]`.

---

## 7. Frontend Engineering Component Checklist `[Recommended Skill: frontend-patterns]`

| Component Name | File Path | Technical Dependencies | Key Interaction / State |
| :--- | :--- | :--- | :--- |
| `<LoomVirtualGrid/>` | `apps/web/components/grid/loom-virtual-grid.tsx` | `@tanstack/react-virtual`, Zustand | 60fps scrolling, 50k rows, sticky left columns |
| `<WaterfallCell/>` | `apps/web/components/grid/cells/waterfall-cell.tsx` | Radix Popover, Lucide | Collapsible single-column view, hover micro-trace |
| `<PreFlightBar/>` | `apps/web/components/grid/pre-flight-bar.tsx` | Framer Motion, Zustand | Glassmorphic floating dock, live cost calculator |
| `<LivingLoomCanvas/>`| `apps/web/components/marketing/3d/living-loom-canvas.tsx` | `@react-three/fiber`, Three.js | Cursor tracking, fiber spline magnetics, CTA hover morph |
| `<SmoothScrollProvider/>`| `apps/web/components/marketing/smooth-scroll-provider.tsx` | `@studio-freight/lenis`, GSAP | Momentum scroll, scroll-linked camera timeline |
| `<MagneticButton/>` | `apps/web/components/ui/magnetic-button.tsx` | Framer Motion | 20px cursor pull radius, spring physics |
| `<SpotlightCard/>` | `apps/web/components/ui/spotlight-card.tsx` | CSS Custom Properties | Radial cursor tracking glow with zero React re-renders |
| `<ValidationRadarCard/>`| `apps/web/components/validation/validation-radar-card.tsx` | SVG, Framer Motion | Real-time Go / No-Go telemetry gauge |
| `<MailboxHealthBar/>`| `apps/web/components/sequencer/mailbox-health-bar.tsx` | Radix Tooltip | SPF/DKIM/DMARC status indicators and volume meter |