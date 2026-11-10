-- Password sign-in support. Additive. Existing users were created through a
-- provider-verified email or by an operator, so they are marked verified at
-- their creation time and keep working.
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
UPDATE users SET email_verified_at = created_at;

-- Single-use, expiring tokens for email verification and password reset.
-- Only the SHA-256 of the token is stored, never the token itself.
CREATE TABLE email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_kind ON email_tokens (user_id, kind);
