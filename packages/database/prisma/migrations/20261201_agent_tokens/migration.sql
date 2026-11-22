-- Agent API Tokens (Slice A: Coding Agent Integration).
-- Additive. Applied-migration history is untouched.
-- Stores SHA-256 hash of the token only; raw secrets are never persisted.
-- Scoped per workspace; optional expiry (nullable expires_at).
CREATE TABLE agent_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  project_id VARCHAR(64),
  token_hash CHAR(64) NOT NULL UNIQUE,
  token_prefix VARCHAR(16) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agent_tokens_workspace_idx ON agent_tokens (workspace_id, created_at DESC);
CREATE INDEX agent_tokens_project_idx ON agent_tokens (workspace_id, project_id);
CREATE UNIQUE INDEX agent_tokens_hash_idx ON agent_tokens (token_hash);
