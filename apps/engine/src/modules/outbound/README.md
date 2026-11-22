# Outbound checkpoint

Exports are available from this directory's index.ts. No shared contracts or
Alpha/Beta implementation files are changed. Existing engine root index.ts is
not edited, so the bootstrap owner should expose/mount these modules explicitly.

- DeliverabilityService: DNS-record diagnostics with an injected resolver and
  bounded TTL cache. Supply the provider's DKIM selector; DNS cannot discover all
  selectors. Unknown/timeout differs from a negative DNS answer. A score does not
  verify a sending IP, DKIM signature, DMARC alignment, recipient reachability or
  inbox placement. Test fixtures are not real sending domains.
- Rotation policy: unpaused, fully DNS-scored mailboxes below daily limits, least
  recently used first; 45-180 second randomized delays. Runtime concurrency,
  counter resets and durable cooldowns belong in the repository/queue adapter.
- DispatchService: one queue tick using repository and transport ports. The
  repository must atomically recheck campaign/tenant/quota/due time/suppression,
  claim an idempotent message and reserve the next dispatch time. AtomicDispatchRepository now implements these operations with parameterized SQL, backed by PrismaDispatchDatabase. PGlite SQL tests pass; native multi-connection testing remains. Do not put a naive read-then-write adapter in production.
  Transport errors are marked uncertain and need reconciliation, not blind retries.

BullMQ queue/worker factories are present but are not started against a real transport. No SMTP/IMAP/OAuth adapter, inbound-reply classifier or live
unsubscribe handler is connected yet. No real messages have been sent. All tests
use fake transports/resolvers. Campaign steps must eventually respect delayHours,
timezone/day rollover and durable delivery/opt-out state before this is runnable.

## Reply acknowledgement boundary

The gated pollMailboxReplies bridge requires an acknowledged pollAndConsume method. It holds the mailbox lock and records every reply/sequence stop before the poller commits seen markers or its UID checkpoint. If handling fails partway, the batch replays; already committed reply IDs remain idempotent. If marker persistence fails after handling, retry also replays without duplicate reply inserts or duplicate halts. A busy lock returns null, not an empty-inbox claim. UIDVALIDITY resets may still safely lower a checkpoint before processing.

ImapReplyPoller.pollOnce remains a compatibility retrieval helper that acknowledges delivery only to its immediate caller. It does not establish durable downstream storage and must not be composed with a later separate reply write. The reliable bridge refuses a legacy pollOnce-only adapter before it fetches. This change does not mount a live poller, turn on its environment gate, create a scheduler, reconcile reserved mail or establish delivery. Tests use disposable local IMAP/database fixtures. Existing reply classification and attribution rules are unchanged.

The real IMAP read client now requests References explicitly and unfolds that requested header within a16KB/32-value bound. Oversized evidence is refused rather than silently shortened. A message with a usable sender but no Message-ID reaches the existing UID-based fallback; its synthetic stored event ID now also includes mailbox identity, preventing equal UIDVALIDITY/UID values in two mailboxes from colliding in workspace reply storage. A UIDVALIDITY change gives a missing-ID message a new identity. References-only replies can use the same existing thread attribution policy as In-Reply-To. Headers are untrusted data, not authenticated identity, consent or authority. A fetched message without a usable sender refuses its batch instead of silently advancing past it. No automatic skip/dead-letter repair or live poll scheduling is added.
