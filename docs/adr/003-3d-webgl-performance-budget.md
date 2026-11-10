# 003: 3D WebGL Bundle Performance Budget & Lazy Hydration Protocol

* **Status:** Accepted
* **Date:** 2026-11-10
* **Deciders:** Principal Staff Engineer, UI Performance Architect
* **Context:** Adding an interactive 3D WebGL hero ("The Living Loom Core") and smooth inertial scrolling (`@studio-freight/lenis` + `@react-three/fiber`) introduces severe risks of bundle bloat, main-thread blocking, degraded Lighthouse scores (LCP $> 3.5\text{s}$), and GPU thrashing on mobile devices or budget laptops. To ensure the landing page remains instant, high-converting, and costs $0 extra to host, a strict performance budget and hydration architecture is mandatory.
* **Recommended Skill:** `[Recommended Skill: animation-performance]` `[Recommended Skill: debug-optimize-lcp]` `[Recommended Skill: animate]`

---

## Decision

We establish an immutable **500KB Asset Budget** and a **Two-Stage Lazy Hydration Pipeline** for all 3D WebGL and motion components:

1. **Asset Budget & Compression Hard-Cap:**
   - **Geometry (.glb):** Models must be Draco-compressed with meshopt quantization. Total geometry file size must not exceed **380KB**.
   - **Textures:** All texture maps must use WebP or KTX2 Basis Universal GPU-compressed format at a maximum resolution of $1024 \times 1024$, capped at **80KB** total.
   - **Shader Code:** GLSL vertex and fragment shaders must be compiled inline or minified to $< 15\text{KB}$.
   - **Total WebGL Asset Payload:** Strictly $\le 500\text{KB}$. Any pull request exceeding this limit is automatically blocked by CI bundle analysis.

2. **Zero-JS Ambient Fallback & Post-FCP Hydration:**
   - Initial server-rendered HTML contains an ultra-lightweight ($< 2\text{KB}$) CSS/SVG ambient gradient mesh.
   - The `@react-three/fiber` canvas is dynamically loaded via `next/dynamic` with `ssr: false` inside a `<Suspense>` boundary.
   - Three.js bundles are fetched strictly *after* First Contentful Paint (FCP) and DOM interactive milestones, guaranteeing an LCP $< 1.2\text{s}$.

3. **Runtime GPU & Battery Fencing:**
   - **Stationary Halting (`frameloop="demand"`):** The WebGL render loop pauses whenever the cursor is stationary and the page is not scrolling. Continuous 60fps rendering is only active during active pointer motion or scroll velocity.
   - **Reduced Motion Conformance:** If `prefers-reduced-motion: reduce` is detected, the WebGL canvas is bypassed entirely, rendering an elegant static SVG illustration.
   - **Low-Tier Device Downgrade:** `detect-gpu` assesses client hardware. On Tier 1 mobile GPUs, particles are reduced from 1,000 to 100, and fiber spline physics are simplified to static linear lines.

4. **Zero-Re-Render Mouse Physics:**
   - Interactive spotlight glows on cards and magnetic CTA physics must never trigger React state re-renders. Mouse coordinates are bound directly to CSS custom properties (`--mouse-x`, `--mouse-y`) or manipulated via `requestAnimationFrame` transforms.

---

## Consequences

### Positive
- Locked 60fps interaction on standard integrated GPUs (e.g. Intel Iris, Apple M-series, AMD Radeon).
- Perfect SEO and Core Web Vitals (Lighthouse Performance score $\ge 95$).
- Zero additional CDN or server costs: assets are served from existing static hosting / Cloudflare R2 free tier.

### Negative / Trade-offs
- 3D artists must optimize polygon counts ($\le 15,000$ triangles total) and bake lighting into shaders rather than using real-time dynamic shadows.
- Users on legacy mobile browsers or battery saver mode receive a high-contrast 2D fallback instead of full 3D physics.
