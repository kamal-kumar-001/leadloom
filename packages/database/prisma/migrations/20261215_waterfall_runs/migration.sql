-- Durable local execution foundation. No provider worker is enabled by this migration.
CREATE TABLE waterfall_runs (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 table_id uuid NOT NULL,
 column_id uuid NOT NULL,
 request_id uuid NOT NULL,
 requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
 payload_hash char(64) NOT NULL,
 config_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(workspace_id,request_id),
 UNIQUE(id,workspace_id),
 FOREIGN KEY(table_id,workspace_id) REFERENCES tables(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY(column_id,table_id) REFERENCES columns(id,table_id) ON DELETE CASCADE
);
CREATE TABLE waterfall_run_rows (
 id uuid PRIMARY KEY,
 run_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 row_id uuid NOT NULL,
 snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','running','applied','conflict','failed','uncertain','canceled')),
 attempt_id uuid,
 claimed_at timestamptz,
 finished_at timestamptz,
 result jsonb,
 UNIQUE(run_id,row_id),
 FOREIGN KEY(run_id,workspace_id) REFERENCES waterfall_runs(id,workspace_id) ON DELETE CASCADE,
 CHECK ((state='queued' AND attempt_id IS NULL AND claimed_at IS NULL AND finished_at IS NULL) OR
        (state='canceled' AND attempt_id IS NULL AND claimed_at IS NULL AND finished_at IS NOT NULL) OR
        (state='running' AND attempt_id IS NOT NULL AND claimed_at IS NOT NULL AND finished_at IS NULL) OR
        (state IN('applied','conflict','failed','uncertain') AND attempt_id IS NOT NULL AND claimed_at IS NOT NULL AND finished_at IS NOT NULL)),
 CHECK(state NOT IN('applied','conflict','failed') OR result IS NOT NULL)
);
CREATE INDEX waterfall_rows_claim_idx ON waterfall_run_rows(workspace_id,state,run_id,id);
