-- Append-only audit trail. Additive. Never store secrets, tokens or message
-- bodies in metadata. Rows survive user deletion (actor kept as plain uuid);
-- workspace_id is cleared, not cascaded, when a workspace is deleted.
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  actor_user_id UUID,
  action VARCHAR(64) NOT NULL,
  target VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_log_workspace_at ON audit_log (workspace_id, at DESC);
