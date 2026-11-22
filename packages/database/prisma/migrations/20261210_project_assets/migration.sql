-- Private-to-workspace project drafts. Never publishes or sends.
CREATE TABLE project_assets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 project_id UUID NOT NULL,
 kind VARCHAR(24) NOT NULL CHECK(kind IN ('product_brief','research','launch_copy','outreach_draft','investor_pitch')),
 current_version INTEGER NOT NULL DEFAULT 1 CHECK(current_version>0),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,workspace_id,project_id),
 FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE CASCADE
);
CREATE TABLE project_asset_versions (
 asset_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 project_id UUID NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 request_id UUID NOT NULL,
 title VARCHAR(160) NOT NULL CHECK(length(trim(title))>0),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 40000),
 created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(asset_id,version),
 UNIQUE(workspace_id,project_id,request_id),
 FOREIGN KEY(asset_id,workspace_id,project_id) REFERENCES project_assets(id,workspace_id,project_id) ON DELETE CASCADE
);
CREATE INDEX idx_project_assets_updated ON project_assets(workspace_id,project_id,updated_at DESC,id DESC);
