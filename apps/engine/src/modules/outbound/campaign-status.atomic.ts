import type { SqlConnection, TransactionalDatabase } from './atomic-dispatch.repository';
export type CampaignStatusResult = { ok: true; status: string } | { ok: false; reason: string } | null;
/** Uses the same campaign-first lock as recipient import and outbound dispatch.
 * All reads and mutation use one transaction connection. No send/enqueue side effects.
 */
export async function setCampaignStatusAtomic(
  database: SqlConnection, workspaceId: string, campaignId: string,
  target: 'draft' | 'active' | 'paused', clock = () => new Date(),
): Promise<CampaignStatusResult> {
  const db = database as TransactionalDatabase;
  if (typeof db.transaction !== 'function') throw new Error('Atomic campaign status change requires a TransactionalDatabase adapter');
  return db.transaction(async tx => {
    const rows = await tx.query<{ status: string; steps: unknown }>(
      'SELECT status, steps FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid FOR UPDATE',
      [workspaceId, campaignId]);
    if (rows.length !== 1) return null;
    const current = rows[0].status;
    if (current === target) return { ok: true, status: current };
    if (target === 'active') {
      if (current !== 'draft' && current !== 'paused') return { ok: false, reason: `Campaign cannot be activated from '${current}'` };
      const steps = Array.isArray(rows[0].steps) ? rows[0].steps : [];
      if (steps.length === 0) return { ok: false, reason: 'Add at least one step before activating' };
      const pool = await tx.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM campaign_mailboxes WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid',
        [workspaceId, campaignId]);
      if ((pool[0]?.n ?? 0) === 0) return { ok: false, reason: 'Assign at least one sender mailbox before activating' };
    } else if (target === 'paused') {
      if (current !== 'active') return { ok: false, reason: `Only an active campaign can be paused (currently '${current}')` };
    } else {
      if (current !== 'paused') return { ok: false, reason: `Pause the campaign before returning it to draft (currently '${current}')` };
    }
    const updated = await tx.query<{status: string}>(
      'UPDATE campaigns SET status=$3, updated_at=$4::timestamptz WHERE workspace_id=$1::uuid AND id=$2::uuid AND status=$5 RETURNING status',
      [workspaceId, campaignId, target, clock().toISOString(), current]);
    if (updated.length !== 1) throw new Error('Campaign changed during locked lifecycle transition');
    return { ok: true, status: updated[0].status };
  });
}
