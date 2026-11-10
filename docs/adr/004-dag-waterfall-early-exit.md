# 004: DAG Waterfall Execution Engine & Credit Preservation Guarantee

* **Status:** Accepted
* **Date:** 2026-11-10
* **Deciders:** Principal Staff Engineer, Data Pipeline Architect
* **Context:** Linear enrichment workflows force users to execute expensive API calls (e.g. $0.05/credit phone lookups or $0.02 AI synthesis) even when a low-cost tier has already returned a verified, deliverable email or when the lead does not match basic qualification criteria. To guarantee zero-waste BYOK API consumption, LeadLoom requires an adaptive Directed Acyclic Graph (DAG) execution engine with strict short-circuiting rules.
* **Recommended Skill:** `[Recommended Skill: backend-patterns]` `[Recommended Skill: tdd-workflow]`

---

## Decision

We implement a reactive **DAG Waterfall Runner** powered by topological node sorting, early-exit short-circuit logic, and dynamic dependency resolution:

1. **DAG Node Definition & Exit Predicates:**
   - Each waterfall node declares:
     - `providerId`: E.g., `apollo_enrich`, `hunter_verify`, `ai_summarize`.
     - `costWeight`: Nominal cost in micro-cents.
     - `exitCondition`: Boolean predicate evaluated against node output (e.g., `status === 'deliverable' && confidence > 0.85`).
     - `fallbackTargets`: Successor node IDs evaluated if the exit condition is false or provider returns HTTP 404/422.

2. **Topological Execution & Short-Circuit Mechanics:**
   - Nodes are ordered strictly by cost-efficiency ratio.
   - When node $N_i$ satisfies its `exitCondition`, the engine triggers `ABORT_SUCCESSORS` for that row branch.
   - Any scheduled BullMQ jobs for downstream nodes are cancelled via Redis job removal tokens, ensuring **zero unnecessary external API calls** are made.

3. **Catch-All & Ambiguity Handling:**
   - If a provider returns `catch-all` or `risky`, the engine does not treat it as an exit match; it branches to an MX-record or SMTP handshake verification worker before falling back to the next tier.

4. **Telemetry & Credit Audit Log:**
   - Every cell execution writes a structured audit log containing: provider attempted, latency in ms, payload hash, cost incurred, and reason for skip/fallback.

---

## Consequences

### Positive
- RevOps teams save 60%–80% of external API costs compared to flat parallel enrichment.
- Deterministic behavior: easy to dry-run and simulate on sample rows before committing bulk runs.
- Transparent audit trail for debugging vendor discrepancies.

### Negative / Trade-offs
- Sequential dependency chains have higher aggregate wall-clock latency per row than firing all APIs simultaneously.
- Mitigated by BullMQ pipelining: rows are processed asynchronously across workers so aggregate batch throughput remains high.
