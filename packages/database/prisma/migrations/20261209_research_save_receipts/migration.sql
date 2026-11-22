-- Durable request receipts. Keep tombstones after row/table deletion so retries
-- never silently recreate deleted research. Workspace deletion removes receipts.
CREATE TABLE research_save_receipts (
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 table_id UUID NOT NULL,
 row_id UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,request_id)
);
