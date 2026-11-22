-- Private aggregate watches only. This migration neither starts workers nor grants provider/send access.
ALTER TABLE validation_experiments ADD CONSTRAINT uq_experiment_id_workspace_project UNIQUE(id,workspace_id,project_id);
CREATE TABLE project_growth_watches (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 experiment_id uuid NOT NULL,
 requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
 authorized_by uuid REFERENCES users(id) ON DELETE SET NULL,
 requested_interval_minutes integer NOT NULL CHECK(requested_interval_minutes BETWEEN 60 AND 10080),
 interval_minutes integer NOT NULL CHECK(interval_minutes BETWEEN 60 AND 10080),
 state text NOT NULL DEFAULT 'active' CHECK(state IN('active','paused','blocked')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 next_due_at timestamptz NOT NULL,
 last_checked_at timestamptz,
 last_digest char(64),
 last_entry_id uuid REFERENCES project_entries(id) ON DELETE SET NULL,
 blocked_reason text CHECK(blocked_reason IN('access_changed','experiment_unavailable','invalid_results')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(workspace_id,project_id,experiment_id),
 FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY(experiment_id,workspace_id,project_id) REFERENCES validation_experiments(id,workspace_id,project_id) ON DELETE CASCADE,
 CHECK((state='blocked' AND blocked_reason IS NOT NULL) OR (state<>'blocked' AND blocked_reason IS NULL))
);
CREATE INDEX project_growth_watches_lookup_idx ON project_growth_watches(workspace_id,project_id,created_at,id);
CREATE INDEX project_growth_watches_due_idx ON project_growth_watches(next_due_at,id) WHERE state='active';
