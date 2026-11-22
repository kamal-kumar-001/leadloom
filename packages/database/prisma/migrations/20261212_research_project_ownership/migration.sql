-- Explicit ownership only for new project-tagged research saves. Historical rows stay unassigned.
CREATE TABLE research_row_projects (
 row_id UUID PRIMARY KEY REFERENCES rows(id) ON DELETE CASCADE,
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 project_id UUID NOT NULL,
 kind VARCHAR(24) NOT NULL CHECK(kind IN ('website','intent-fixture')),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE RESTRICT
);
CREATE INDEX idx_research_row_projects_project ON research_row_projects(workspace_id,project_id,kind,row_id);
