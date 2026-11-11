-- G9 Approval-before-send: allow pending_approval and rejected job statuses
ALTER TABLE outbound_jobs DROP CONSTRAINT IF EXISTS outbound_job_integrity;
ALTER TABLE outbound_jobs ADD CONSTRAINT outbound_job_integrity CHECK (
  status IN ('pending_approval','pending','reserved','accepted','uncertain','cancelled','rejected') AND
  recipient_hash ~ '^[a-f0-9]{64}$' AND step_number > 0 AND attempts >= 0
);
