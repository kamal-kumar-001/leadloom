# 003: Ultra-Low-Cost Single-VPS Container Architecture & FinOps Topology

* **Status:** Accepted
* **Date:** 2026-11-10
* **Deciders:** Principal Staff Engineer, FinOps & Infrastructure Lead
* **Context:** Competitor platforms force customers into expensive multi-tenant tiers or require complex Kubernetes / distributed cloud setups costing hundreds of dollars monthly. Self-hosters and bootstrapped growth teams need a zero-to-low-cost deployment footprint that runs comfortably on a single budget VPS (Hetzner, OVH, DigitalOcean, or Linode) priced between $4.00 and $6.00/month (2 vCPU, 4GB RAM, 40GB NVMe SSD).
* **Recommended Skill:** `[Recommended Skill: backend-patterns]` `[Recommended Skill: coding-standards]`

---

## Decision

We package LeadLoom as an **Optimized Containerized Monolith** orchestrated via a single hardened `docker-compose.yml` with strict Linux cgroup limits, in-process optimizations, and co-located storage:

1. **Service Allocation & Resource Quotas (4GB RAM Budget):**
   - **PostgreSQL 16 + `pgvector`:**
     - Co-located extension avoids external vector DB expenses (Pinecone / Qdrant).
     - Memory limit: `1024MB` (`shared_buffers = 256MB`, `work_mem = 16MB`, `maintenance_work_mem = 64MB`).
     - Connection limit capped at 50 connections via built-in connection pooler / Prisma client tuning.
   - **Redis 7 (Alpine):**
     - Shared cache, BullMQ message broker, and rate-limit token bucket repository.
     - Memory limit: `384MB` with `maxmemory-policy allkeys-lru`.
   - **NestJS Core Engine + Scraper Queue:**
     - Memory limit: `1280MB`. Single Node.js process using `--max-old-space-size=1024`.
     - Houses BullMQ queue runners, DAG waterfall processor, IMAP/SMTP sync engine.
   - **Next.js Web App (Standalone Node output):**
     - Memory limit: `512MB`. High-efficiency standalone build.
   - **Headless Playwright Scraping Worker (Ephemeral / Single Worker):**
     - Memory limit: `640MB`. Single Chromium instance launched in headful-offscreen mode with request interception disabling image, font, and CSS downloads to minimize RAM/CPU consumption.
   - **OS & Buffer Cache Reserve:** `200MB`.

2. **Domain-Level Cache & Request Deduplication Engine:**
   - Any external API request (Hunter, Apollo, Dropcontact, Perplexity) is hashed by normalized domain: `hash(provider + ":" + normalized_domain)`.
   - Stored in Redis with 30-day TTL and backed by a PostgreSQL `enrichment_cache` table.
   - If User A or Row 1 already enriched `stripe.com` on Hunter 5 days ago, Row 400 or User B resolves instantly from cache at **$0.00 external API cost**.

3. **Local & Free LLM Routing Protocol:**
   - First-class support for local `Ollama` daemon (running on host or adjacent box), Groq free tier, and DeepSeek / Gemini Flash API keys.
   - Fallback hierarchy: `Local Ollama / Gemini 1.5 Flash -> DeepSeek-V3 -> GPT-4o-mini / Claude 3.5 Haiku`.

---

## Consequences

### Positive
- Deployable anywhere with a single command: `docker compose up -d`.
- Predictable fixed hosting cost of ~$4–$6/month regardless of enrichment volume.
- Up to 85% external API cost reduction through cross-campaign domain-level cache reuse.
- Vector similarity search (for ICP clustering and account deduplication) runs natively in Postgres at zero marginal cost.

### Negative / Trade-offs
- Headless scraping concurrency is capped at 2 parallel browser contexts on a 4GB VPS. Workloads requiring $> 50$ concurrent scrapes must spin up an external scraping worker or use a proxy service.
- If memory limits are breached without swap, Docker OOM-killer will restart the worker container. Mitigation: A 2GB host swapfile is mandated in the setup guide.
