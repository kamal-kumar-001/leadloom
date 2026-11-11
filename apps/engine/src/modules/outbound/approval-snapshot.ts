import { createHash } from 'node:crypto';

/**
 * What an approval actually signs off on. The hash is computed SERVER-SIDE at
 * enqueue time and recomputed at approve time; an approval is only valid while
 * both match. Any edit to content, recipient, or sender/mailbox context
 * changes the hash and therefore invalidates the approval.
 *
 * Canonicalization: recipients are lowercased/trimmed, mailbox ids sorted,
 * JSON keys sorted recursively, so semantically identical inputs always hash
 * identically regardless of key order or array order.
 */
export interface ApprovalSnapshot {
  v: 1;
  campaignId: string;
  stepNumber: number;
  recipientEmail: string;
  subject: string;
  bodyTemplate: string;
  /** Sorted mailbox ids the campaign may send from (sender context). */
  mailboxIds: string[];
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function approvalContentHash(snapshot: ApprovalSnapshot): string {
  return createHash('sha256').update(canonicalize(snapshot)).digest('hex');
}

/** Builds the snapshot for one job from campaign data already fetched with tenant scoping. */
export function buildApprovalSnapshot(input: {
  campaignId: string;
  stepNumber: number;
  recipientEmail: string;
  campaignSteps: unknown;
  mailboxIds: string[];
}): ApprovalSnapshot {
  const steps = Array.isArray(input.campaignSteps) ? (input.campaignSteps as Array<Record<string, unknown>>) : [];
  const step = steps.find((s) => Number(s.stepNumber ?? s.step) === input.stepNumber) ?? {};
  return {
    v: 1,
    campaignId: input.campaignId,
    stepNumber: input.stepNumber,
    recipientEmail: input.recipientEmail.trim().toLowerCase(),
    subject: String(step.subject ?? ''),
    bodyTemplate: String(step.bodyTemplate ?? step.body ?? ''),
    mailboxIds: [...input.mailboxIds].map((m) => m.toLowerCase()).sort(),
  };
}
