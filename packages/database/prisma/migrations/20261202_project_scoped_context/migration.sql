-- Project-Scoped Agent Context (Slice B: Multi-Project Hard Isolation)
-- Additive. Applied-migration history is untouched.

CREATE TABLE project_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_contexts_workspace_project UNIQUE (workspace_id, project_id)
);

CREATE INDEX idx_project_contexts_lookup ON project_contexts (workspace_id, project_id);
