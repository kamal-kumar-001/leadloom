-- Inbound reply bookkeeping: atomic dedupe of reply markers and per-mailbox
-- IMAP uid checkpoints. Additive only; no existing rows touched.

CREATE TABLE IF NOT EXISTS mailbox_sync_state (
  mailbox_id UUID PRIMARY KEY REFERENCES mailboxes(id) ON DELETE CASCADE,
  last_inbound_uid INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reply markers are outreach_events rows of type 'reply_received'; the partial
-- unique index makes the dedupe insert atomic (ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX IF NOT EXISTS outreach_events_reply_dedupe
  ON outreach_events (mailbox_id, message_id)
  WHERE message_id IS NOT NULL AND type = 'reply_received';
