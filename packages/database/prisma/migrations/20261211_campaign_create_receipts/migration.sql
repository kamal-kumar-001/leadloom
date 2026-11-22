-- Request receipt survives campaign deletion to prevent accidental recreation.
CREATE TABLE campaign_create_receipts (
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 campaign_id UUID NOT NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,request_id)
);
