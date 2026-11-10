import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { z } from 'zod';
import type { DispatchService } from './dispatch.service';
const TickSchema=z.object({workspaceId:z.string().uuid(),campaignId:z.string().uuid()}).strict();
export const OUTBOUND_QUEUE='outbound-queue';
/** Payloads hold identifiers only, never recipient lists or plaintext credentials. */
export function createOutboundQueue(connection:ConnectionOptions):Queue {
 return new Queue(OUTBOUND_QUEUE,{connection,defaultJobOptions:{attempts:1,removeOnComplete:{count:1000},removeOnFail:{count:1000}}});
}
/**
 * Call only in the worker runtime. Repository-enforced cooldown and quotas are
 * authoritative. BullMQ retries are disabled because provider outcomes can be
 * uncertain. Operator reconciliation is required for ambiguous/crashed sends.
 */
export function createOutboundWorker(connection:ConnectionOptions,dispatch:DispatchService):Worker {
 const worker=new Worker(OUTBOUND_QUEUE,async job=>{
  const data=TickSchema.parse(job.data);
  return dispatch.dispatchOnce(data.workspaceId,data.campaignId);
 },{connection,concurrency:1});
 worker.on('error',()=>{ console.error('Outbound queue connection failed'); });
 return worker;
}
