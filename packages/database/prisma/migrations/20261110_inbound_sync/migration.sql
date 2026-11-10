-- Inbound reply bookkeeping: atomic dedupe of reply markers and per-mailbox
-- IMAP uid checkpoints. Additive only; no existing rows touched.
--
-- This directory name sorts BEFORE 20261110_init_v2, so on an empty database
-- the base tables do not exist yet. It is therefore a guarded no-op there and
-- 20261111_inbound_sync_ensure creates the same objects after init. On a
-- database where init already ran, the objects are created here as before.
DO $$
BEGIN
  IF to_regclass('public.mailboxes') IS NOT NULL
     AND to_regclass('public.outreach_events') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS mailbox_sync_state (
      mailbox_id UUID PRIMARY KEY REFERENCES mailboxes(id) ON DELETE CASCADE,
      last_inbound_uid INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS outreach_events_reply_dedupe
      ON outreach_events (mailbox_id, message_id)
      WHERE message_id IS NOT NULL AND type = 'reply_received';
  END IF;
END $$;
