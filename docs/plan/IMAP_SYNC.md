# IMAP reply sync: status and limits

Source only. Nothing here is wired to a scheduler, endpoint or live mailbox. Fixture-tested only.

## What exists
- `createImapflowClient` (outbound/transport/client-factories.ts): EXAMINE (read-only) open, UID search then UID fetch, at most `maxBatch` (100) messages per poll, body capped (20000 chars), subject capped. Returns UIDVALIDITY.
- `ImapReplyPoller`: dedupe key is a hash of mailbox-scoped `Message-ID + sender`, or `uidvalidity:uid` when the Message-ID is missing. A UIDVALIDITY change resets the checkpoint to 0 and refetches; the dedupe key protects against replays. A per-mailbox lock stops concurrent polls.
- `PrismaSeenMessageStore`: dedupe is `INSERT ... ON CONFLICT DO NOTHING` on `(mailbox_id, message_id)`; the checkpoint only moves forward except through `resetCheckpoint`; the lock is a transaction-scoped advisory lock with a 120 s transaction timeout.
- Migration `20261119_mailbox_uid_validity` (additive, nullable column).

## What does NOT exist yet (must precede any live use)
- Strict TLS / public-host pinning: DONE on the poller path (buildReadOptions: port allow-list, resolve once, public-only, pinned IP, SNI, TLS1.2+, STARTTLS on 143), unit-tested with fake resolvers; not yet tested against a real TLS fixture on this path.
- A caller that resolves the mailbox credential. Tenant check lives at that caller: it must load the mailbox by `(workspace_id from the session, mailbox_id)` and the campaign by the same workspace before polling. `mailboxId` alone is not a tenant check.
- DSN/bounce handling: DONE as deterministic detection (`bounce.ts`, RFC 3464-style fixtures, no live data). A DSN is classified `bounce` before the keyword baseline so quoted original text is never misread; failed-recipient and RFC 3463 status extraction exists for the future suppression wiring (NOT persisted yet).
- Poll error backoff: DONE as a tested helper (`PollBackoff`: bounded exponential backoff with jitter, reset on success). Not yet wired to a scheduler (no scheduler exists).
- Poll enablement flag and retention policy for `bodyText` beyond the cap.
- Atomic "persist event + advance checkpoint" in one transaction: today events are recorded one by one and the checkpoint advances after the batch; a crash replays the batch and dedupe makes it idempotent.

## Safety properties
- Message content is untrusted data. The poller classifies with a deterministic baseline and returns events. It never acts on content.
- `plaintextForTestsOnly` is refused for non-loopback hosts and when `NODE_ENV=production`.
