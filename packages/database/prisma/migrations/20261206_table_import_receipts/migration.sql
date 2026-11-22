CREATE TABLE table_import_receipts (
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 table_id UUID NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 imported_count INTEGER NOT NULL,
 column_count INTEGER NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(table_id,workspace_id) REFERENCES tables(id,workspace_id) ON DELETE CASCADE
);
