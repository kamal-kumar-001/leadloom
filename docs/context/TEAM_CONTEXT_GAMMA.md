# Team Gamma Context Capsule — Outbound Sequencer, Deliverability, Security & Infra

* **Team Name:** Team Gamma (Deliverability, Cryptography, Database & Infrastructure)
* **Designated Skills:** `[Recommended Skill: security-review]` `[Recommended Skill: backend-patterns]` `[Recommended Skill: coding-standards]` `[Recommended Skill: troubleshooting]`
* **Primary Scope:** SMTP/IMAP mailbox pool manager, deliverability DNS verification (SPF/DKIM/DMARC), AES-256-GCM BYOK Vault, PostgreSQL schema & migrations (`packages/database`), and single-VPS Docker Compose FinOps.

---

## 1. Owned Physical Directories (Strict Write Permissions)
- `apps/engine/src/modules/outbound/**`
- `apps/engine/src/modules/auth/**`
- `apps/engine/src/modules/vault/**`
- `packages/database/**`
- `docker/**`
- `docker-compose.yml`

> **Forbidden Pattern:** Team Gamma agents are strictly forbidden from modifying `apps/web/**` or `apps/engine/src/modules/waterfall/**`. All outbound API definitions and database types must be published to `packages/contracts`.

---

## 2. Shared Contracts & Interfaces (`packages/contracts`)
- **Implements:**
  - `outbound.contract.ts` (`MailboxHealthStatus`, `CampaignStep`, `InboundReplyEvent`)
  - `vault.contract.ts` (`SaveBYOKCredentialRequest`, `MaskedBYOKCredential`)
- **Maintains Database Client:**
  - Exports Prisma client from `packages/database` consumed by `apps/engine` and `workers`.

---

## 3. Active Task Queue
1. **AES-256-GCM Vault:** Implement envelope encryption with unique 12-byte IV, 16-byte auth tag, master KEK rotation, and in-memory variable zeroing.
2. **Deliverability Health Engine:** Automated SPF, DKIM, and DMARC DNS lookups with cached health scores and volume throttling.
3. **Mailbox Rotation & Jitter:** Sequencer dispatch loop with randomized human delays ($45\text{s} \text{ to } 180\text{s}$) across rotated accounts.
4. **Single-VPS Docker Compose Hardening:** Keep all 5 containers (Next.js, NestJS, Postgres/pgvector, Redis, Playwright) under 3.5GB RAM on a 4GB VPS.

---

## 4. Context Checkpoint Protocol
Before writing code:
1. Read the last 20 lines of `docs/context/SYNC_FEED.md`.
2. Inspect `docs/adr/001-byok-encryption.md` and `docs/adr/003-single-vps-finops-docker.md`.
3. Load designated skill before editing security or database files.
