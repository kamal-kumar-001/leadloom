-- AlterTable: a job may point at its campaign_recipients row (live fields: an
-- edit invalidates the approval hash) or carry inline recipient_fields fixed
-- at enqueue time. One of the two is required whenever the step template uses
-- variables; resolution fails closed otherwise.
ALTER TABLE "outbound_jobs" ADD COLUMN "recipient_id" UUID;
ALTER TABLE "outbound_jobs" ADD COLUMN "recipient_fields" JSONB;

-- CreateIndex
CREATE INDEX "outbound_jobs_recipient_id_idx" ON "outbound_jobs"("recipient_id");

-- AddForeignKey
ALTER TABLE "outbound_jobs" ADD CONSTRAINT "outbound_jobs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "campaign_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
