-- Password sign-in support. Additive.
-- email_verified_at: only set when the engine has its own record that the address
-- was proven. A user is backfilled as verified ONLY if the audit log shows they
-- were provisioned from a provider-verified email (action user.provisioned,
-- method verified_email). Anyone else (operator-created, fixtures, anything
-- self-asserted) stays unverified: they cannot password sign in until they prove
-- the mailbox through a reset link. Provider sign-in does not use this column.
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
-- Bumped on every credential change; engine sessions carry the version they were issued under.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
UPDATE users u SET email_verified_at = a.at
  FROM audit_log a
 WHERE a.action = 'user.provisioned'
   AND a.target = u.id::text
   AND a.metadata ->> 'method' = 'verified_email';

-- One-time codes for signup verification and password reset. Only an HMAC of the
-- code is stored (keyed with a server secret), never the code. Purpose-bound,
-- expiring, single-use, with a failed-attempt counter.
CREATE TABLE email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(16) NOT NULL CHECK (purpose IN ('signup', 'reset')),
  code_hash CHAR(64) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_otps_user_purpose ON email_otps (user_id, purpose, created_at DESC);
