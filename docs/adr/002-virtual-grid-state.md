# 002: High-Density Virtual Grid State Management (50,000+ Rows)

* **Status:** Accepted
* **Date:** 2026-11-10
* **Deciders:** Principal Staff Engineer, UI Architect
* **Context:** LeadLoom's primary data canvas must render 50,000+ rows with up to 40 dynamic enrichment columns. Standard React component state (e.g., storing rows in React `useState` or passing state down via Context) triggers catastrophic re-render cascades, memory leaks, and frame drops ($< 15\text{fps}$) when hundreds of cell updates stream in concurrently from BullMQ worker WebSockets.
* **Recommended Skill:** `[Recommended Skill: frontend-patterns]` `[Recommended Skill: animation-performance]`

---

## Decision

We decouple UI rendering from grid data storage using a **Normalized Slice Store** coupled with **TanStack Virtual Windowing**:

1. **State Store Architecture (Zustand + Immer + Normalized Maps):**
   - Grid data is stored out of the React render tree in a Zustand store.
   - Rows are indexed in a normalized map: `rowsById: Record<string, RowRecord>` and an ordered array of IDs: `rowOrder: string[]`.
   - Cell updates target precise cell coordinate paths: `updateCell(rowId, columnId, cellData)` without mutating the parent row container or adjacent rows.

2. **Virtual Windowing Layer (`@tanstack/react-virtual`):**
   - The DOM maintains only the visible viewport slice ($\sim 30\text{–}45$ rows rendered simultaneously) with an overscan of 5 rows.
   - Column virtualization is enabled for tables exceeding 15 columns to prevent horizontal layout thrashing.
   - Fixed heights ($36\text{px}$ compact, $48\text{px}$ standard) ensure $O(1)$ coordinate offsets and zero cumulative layout shifts (CLS).

3. **Fine-Grained Reactive Cell Subscriptions:**
   - `<LoomCell rowId={id} colId={col} />` subscribes exclusively to its own slice selector: `useLoomStore(state => state.rowsById[id]?.cells[col])`.
   - Incoming WebSocket cell events (e.g., status changes from `Running` to `Verified`) update only the specific `<LoomCell />` DOM node, maintaining a steady 60fps frame rate even under 500 updates/sec.

4. **Web Worker Offloading for Sorting & Filtering:**
   - Multi-column sorting, regex filtering, and formula evaluations across 50,000 rows run in a dedicated Web Worker (`grid-calc.worker.ts`), preventing main thread freezing.

---

## Consequences

### Positive
- Sub-millisecond cell update latency and silky 60fps scrolling across 100k+ records.
- Memory consumption in the browser stays bounded ($< 80\text{MB}$ heap footprint for 50,000 rows).
- Completely prevents React "Maximum update depth exceeded" errors during high-throughput enrichment runs.

### Negative / Trade-offs
- Requires strict adherence to selector patterns: developers must never select the entire `rowsById` object in row/cell components.
- Complex copy-paste and multi-range selection requires explicit coordinate math rather than native HTML table selection.
