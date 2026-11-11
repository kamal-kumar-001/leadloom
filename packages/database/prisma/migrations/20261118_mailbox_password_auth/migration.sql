-- Mailbox connection by app password (IMAP/SMTP). Additive only.
-- The secret is sealed with the existing ADR-001 envelope columns on mailboxes (the access-token
-- envelope holds the app password, bound by AAD to workspace, mailbox id and provider
-- 'mailbox-password'); no plaintext column exists. auth_type says which kind of secret is sealed.
ALTER TABLE mailboxes ADD COLUMN auth_type VARCHAR(16) NOT NULL DEFAULT 'oauth2';
ALTER TABLE mailboxes ADD COLUMN connection_status VARCHAR(16) NOT NULL DEFAULT 'unknown';
ALTER TABLE mailboxes ADD COLUMN connection_checked_at TIMESTAMPTZ;
ALTER TABLE mailboxes ADD COLUMN connection_error_code VARCHAR(32);
