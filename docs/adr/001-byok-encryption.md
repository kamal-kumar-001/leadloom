# 001: Bring-Your-Own-Key (BYOK) Envelope Encryption Architecture

* **Status:** Accepted
* **Date:** 2026-11-10
* **Deciders:** Principal Staff Engineer, Security Architect
* **Context:** LeadLoom allows users to provide their own API keys for providers like Apollo, Hunter, OpenAI, Anthropic, and custom SMTP/IMAP credentials. Storing these credentials in plaintext or with reversible static encryption poses severe security risks, especially in self-hosted and multi-tenant environments.
* **Recommended Skill:** `[Recommended Skill: security-review]`

---

## Decision

We implement a two-tier **Envelope Encryption** architecture using **AES-256-GCM** (Galois/Counter Mode) with hardware-accelerated Node.js `crypto` primitives:

1. **Master Key (KEK - Key Encryption Key):**
   - 256-bit entropy derived from `LEADLOOM_MASTER_KEY` environment variable or local machine hardware ID + Docker secret.
   - In cloud mode, optional integration with AWS KMS, HashiCorp Vault, or GCP Cloud KMS.
   - The KEK never enters the database and never leaves the server memory.

2. **Data Encryption Key (DEK) / Ciphertext Model:**
   - Every credential record (`byok_credentials`) stores:
     - `encrypted_key_ciphertext`: Buffer stored as Base64 / Hex.
     - `iv`: 12-byte cryptographic nonce unique per record (never reused under same key).
     - `auth_tag`: 16-byte authentication tag ensuring integrity and authentic ciphertext verification (detects tampering).
     - `algorithm`: Default `aes-256-gcm`.
     - `key_version`: Integer tracking rotation epoch of the master KEK.

3. **In-Memory Lifetime & Decryption Protocol:**
   - Decryption occurs strictly at the execution boundary: immediately before BullMQ worker dispatches the external HTTP call.
   - Plaintext keys are ephemeral variables scoped to worker function executions and garbage-collected immediately.
   - Keys are explicitly scrubbed (`key.fill(0)`) after worker HTTP execution completes.
   - Plaintext keys are forbidden from logs, traces, client-side serialization, and error payloads.

---

## Consequences

### Positive
- **Tamper-Evident:** Any modification to database rows triggers an authentication tag mismatch and immediately invalidates execution.
- **Zero-Knowledge Multi-Tenancy:** In self-hosted setups, raw credentials cannot be extracted from static database backups without the runtime environment KEK.
- **Key Rotation Ready:** `key_version` column allows rolling re-encryption without service downtime.

### Negative / Trade-offs
- Slight CPU overhead on high-frequency queue dispatches (benchmarked at $< 0.08\text{ms}$ per AES-256-GCM cycle in Node.js v20+).
- If the operator loses the `LEADLOOM_MASTER_KEY` without backups, stored BYOK credentials cannot be recovered and must be re-entered.
