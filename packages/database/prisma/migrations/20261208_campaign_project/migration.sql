-- New campaign ownership is explicit. Existing campaigns remain unassigned.
ALTER TABLE campaigns ADD COLUMN project_id UUID;
ALTER TABLE campaigns ADD CONSTRAINT fk_campaign_project_tenant
 FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE NO ACTION;
CREATE INDEX campaigns_workspace_id_project_id_created_at_idx ON campaigns(workspace_id,project_id,created_at);
