-- Idempotent re-assertion of the inbound bookkeeping objects. Needed because
-- 20261110_inbound_sync sorts before 20261110_init_v2 and is a no-op on an
-- empty database. Safe no-op where the objects already exist.
CREATE TABLE IF NOT EXISTS mailbox_sync_state (
  mailbox_id UUID PRIMARY KEY REFERENCES mailboxes(id) ON DELETE CASCADE,
  last_inbound_uid INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_events_reply_dedupe
  ON outreach_events (mailbox_id, message_id)
  WHERE message_id IS NOT NULL AND type = 'reply_received';
