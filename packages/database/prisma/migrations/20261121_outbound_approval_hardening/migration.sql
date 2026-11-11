-- G9 hardening: 'approved' is a non-dispatch-eligible held state (claim only picks 'pending'),
-- plus the snapshot/hash an approval is verified against. Additive; no data changes.
ALTER TABLE outbound_jobs DROP CONSTRAINT IF EXISTS outbound_job_integrity;
ALTER TABLE outbound_jobs ADD CONSTRAINT outbound_job_integrity CHECK (
  status IN ('pending_approval','approved','pending','reserved','accepted','uncertain','cancelled','rejected') AND
  recipient_hash ~ '^[a-f0-9]{64}$' AND step_number > 0 AND attempts >= 0
);
ALTER TABLE outbound_jobs ADD COLUMN IF NOT EXISTS approval_content_hash text;
ALTER TABLE outbound_jobs ADD COLUMN IF NOT EXISTS approval_snapshot jsonb;
ALTER TABLE outbound_jobs ADD COLUMN IF NOT EXISTS approved_at timestamptz;
