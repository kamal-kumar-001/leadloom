-- Explicit ownership for newly created project tables; existing tables stay unassigned.
ALTER TABLE tables ADD COLUMN project_id UUID;
ALTER TABLE tables ADD CONSTRAINT fk_table_project_tenant
 FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE NO ACTION;
CREATE INDEX tables_workspace_id_project_id_created_at_idx ON tables(workspace_id,project_id,created_at);
