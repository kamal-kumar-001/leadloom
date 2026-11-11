-- AlterTable: a job may be pinned to one sender mailbox from the campaign's
-- assigned pool (campaign_mailboxes). NULL keeps pool rotation at claim time.
-- The pin is part of the approval snapshot's sender context, so changing it
-- re-hashes the approval and requires deliberate re-review.
ALTER TABLE "outbound_jobs" ADD COLUMN "sender_mailbox_id" UUID;

-- CreateIndex
CREATE INDEX "outbound_jobs_sender_mailbox_id_idx" ON "outbound_jobs"("sender_mailbox_id");

-- AddForeignKey: a removed mailbox unpins the job back to pool rotation.
ALTER TABLE "outbound_jobs" ADD CONSTRAINT "outbound_jobs_sender_mailbox_id_fkey" FOREIGN KEY ("sender_mailbox_id") REFERENCES "mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
