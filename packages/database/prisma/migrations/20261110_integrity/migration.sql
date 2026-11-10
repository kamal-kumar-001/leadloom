-- Prisma does not express these CHECK constraints. Keep this migration after
-- the generated schema migration. No live DB is changed by generating it.
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'member', 'read_only'));
ALTER TABLE byok_credentials ADD CONSTRAINT byok_envelope_check CHECK (
  octet_length(iv) = 12 AND octet_length(auth_tag) = 16 AND
  octet_length(wrapped_dek) = 32 AND octet_length(dek_iv) = 12 AND
  octet_length(dek_auth_tag) = 16 AND key_version > 0 AND algorithm = 'aes-256-gcm'
);
ALTER TABLE suppression_list ADD CONSTRAINT suppression_hash_check CHECK (email_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE mailboxes ADD CONSTRAINT mailbox_limits_check CHECK (
  daily_send_limit > 0 AND sent_today >= 0 AND health_score BETWEEN 0 AND 100 AND key_version > 0
);
ALTER TABLE campaigns ADD CONSTRAINT campaign_limits_check CHECK (daily_limit_total > 0);
ALTER TABLE columns ADD CONSTRAINT column_layout_check CHECK (width BETWEEN 60 AND 800 AND order_index >= 0);
ALTER TABLE rows ADD CONSTRAINT row_order_check CHECK (order_index >= 0);
ALTER TABLE outbound_jobs ADD CONSTRAINT outbound_job_integrity CHECK (
  status IN ('pending','reserved','accepted','uncertain','cancelled') AND
  recipient_hash ~ '^[a-f0-9]{64}$' AND step_number > 0 AND attempts >= 0
);
ALTER TABLE campaign_daily_usage ADD CONSTRAINT campaign_usage_nonnegative CHECK (reserved_count >= 0);
ALTER TABLE mailbox_daily_usage ADD CONSTRAINT mailbox_usage_nonnegative CHECK (reserved_count >= 0);
