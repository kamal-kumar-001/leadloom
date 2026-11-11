-- G10: recipient-hash attribution that spans multiple campaigns is ambiguous by
-- construction; record it as such instead of pretending a job was identified.
ALTER TABLE "inbound_replies" DROP CONSTRAINT IF EXISTS "inbound_replies_attribution_check";
ALTER TABLE "inbound_replies" ADD CONSTRAINT "inbound_replies_attribution_check"
  CHECK ("attribution" IN ('thread_header','recipient_match','ambiguous_recipient','unattributed'));
