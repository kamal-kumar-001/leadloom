-- Explicit optional project ownership for new validation experiments.
-- Existing workspace experiments stay unassigned; never infer ownership from names or context.
ALTER TABLE validation_experiments ADD COLUMN project_id UUID;
ALTER TABLE validation_experiments ADD CONSTRAINT fk_experiment_project_tenant
 FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE NO ACTION;
CREATE INDEX validation_experiments_workspace_id_project_id_created_at_idx
 ON validation_experiments(workspace_id,project_id,created_at);
