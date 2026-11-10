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
