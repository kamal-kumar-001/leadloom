-- G10: persisted inbound replies with attribution to the outbound job they answer.
-- Additive; no changes to existing tables.
CREATE TABLE IF NOT EXISTS "inbound_replies" (
  "id" uuid PRIMARY KEY,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "outbound_job_id" uuid REFERENCES "outbound_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "campaign_id" uuid,
  "mailbox_id" uuid,
  "message_id" text NOT NULL,
  "from_email" text NOT NULL,
  "subject" text,
  "classification" text NOT NULL CHECK ("classification" IN ('interested','objection','out_of_office','unsubscribe','neutral','bounce')),
  "confidence" double precision NOT NULL DEFAULT 0,
  "attribution" text NOT NULL CHECK ("attribution" IN ('thread_header','recipient_match','unattributed')),
  "received_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("workspace_id","message_id")
);
CREATE INDEX IF NOT EXISTS "inbound_replies_workspace_campaign_idx" ON "inbound_replies" ("workspace_id","campaign_id");
