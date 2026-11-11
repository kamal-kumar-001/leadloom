-- IMAP UIDVALIDITY per mailbox. Additive and nullable: NULL means none recorded yet.
ALTER TABLE mailbox_sync_state ADD COLUMN IF NOT EXISTS uid_validity BIGINT;
