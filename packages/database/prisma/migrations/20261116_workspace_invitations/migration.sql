-- Workspace invitations. Additive. Applied-migration history is untouched.
-- An invitation binds a lowercase email to a workspace and a role. It carries no
-- secret and no token: it is claimed only when that email is proven (verified
-- password signup or provider sign-in) while the account is being created.
-- Nothing here sends mail. One workspace per user is still the model, so an
-- address that already has an account cannot be invited.
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL CHECK (email = lower(email)),
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'member', 'read_only')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- At most one open invitation per workspace and address.
CREATE UNIQUE INDEX workspace_invitations_open_unique
  ON workspace_invitations (workspace_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX workspace_invitations_email ON workspace_invitations (email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX workspace_invitations_workspace ON workspace_invitations (workspace_id, created_at DESC);
