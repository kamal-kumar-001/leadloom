-- Workspace-Owned Projects Registry (Slice B: Canonical Project Registry)
-- Additive. Applied-migration history is untouched.

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_projects_workspace_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX idx_projects_workspace_slug ON projects (workspace_id, slug);
CREATE INDEX idx_projects_workspace_created ON projects (workspace_id, created_at DESC);
