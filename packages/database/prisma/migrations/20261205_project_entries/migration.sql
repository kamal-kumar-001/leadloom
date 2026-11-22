-- Append-only project work record. No change to existing context snapshots.
ALTER TABLE projects ADD CONSTRAINT uq_projects_id_workspace UNIQUE(id,workspace_id);
CREATE TABLE project_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 project_id UUID NOT NULL,
 request_id UUID NOT NULL,
 kind VARCHAR(16) NOT NULL CHECK(kind IN ('decision','progress','blocker','next_step','research','note')),
 title VARCHAR(160) NOT NULL CHECK(length(trim(title))>0),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 6000),
 created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT fk_project_entry_tenant FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE CASCADE,
 CONSTRAINT uq_project_entry_request UNIQUE(workspace_id,project_id,request_id)
);
CREATE INDEX idx_project_entries_lookup ON project_entries(workspace_id,project_id,created_at DESC,id DESC);
CREATE INDEX idx_project_entries_search ON project_entries USING gin(to_tsvector('english',title || ' ' || body));
