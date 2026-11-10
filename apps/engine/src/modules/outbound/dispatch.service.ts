import { computeDispatchDelayMs, pickNextMailbox, type RotatableMailbox } from './rotation.service';

export interface DispatchSnapshot {
  workspaceId: string;
  campaignId: string;
  active: boolean;
  dailyLimitTotal: number;
  sentToday: number;
  mailboxes: RotatableMailbox[];
}
export interface SendReservation {
  id: string;
  workspaceId: string;
  campaignId: string;
  mailboxId: string;
  /** Transport-specific synthetic/reference payload, never a plaintext credential. */
  messageRef: string;
}
export interface DispatchRepository {
  snapshot(workspaceId: string, campaignId: string): Promise<DispatchSnapshot | null>;
  /**
   * REQUIRED: one atomic database transaction must recheck tenant/campaign/mailbox,
   * suppression, quotas, sequence due time and the per-pool next-dispatch time,
   * then reserve quota and record an idempotent message before returning it.
   * Return null on contention/no due lead. Never implement as read-then-write.
   */
  claim(input: { workspaceId: string; campaignId: string; mailboxId: string; now: Date; nextDispatchAt: Date }): Promise<SendReservation | null>;
  finish(workspaceId: string, reservationId: string, state: 'accepted' | 'uncertain', providerMessageId?: string): Promise<void>;
}
export interface OutboundTransport {
  send(reservation: SendReservation): Promise<{ providerMessageId: string }>;
}

/**
 * One queue tick of sequencing. No built-in real transport or live worker is
 * supplied. Call only from an authorized, authenticated sending workflow.
 * Provider failures are uncertain, not blindly retried: SMTP may accept a
 * message before a network error. Repository must retain an audit record.
 */
export class DispatchService {
  constructor(
    private readonly repository: DispatchRepository,
    private readonly transport: OutboundTransport,
    private readonly clock: () => Date = () => new Date(),
    private readonly rng: () => number = Math.random,
  ) {}

  async dispatchOnce(workspaceId: string, campaignId: string): Promise<'idle' | 'accepted' | 'uncertain'> {
    if (!workspaceId || !campaignId) throw new Error('Authenticated campaign context required');
    const snapshot = await this.repository.snapshot(workspaceId, campaignId);
    if (!snapshot) return 'idle';
    if (snapshot.workspaceId !== workspaceId || snapshot.campaignId !== campaignId) throw new Error('Campaign scope mismatch');
    if (!snapshot.active || snapshot.sentToday >= snapshot.dailyLimitTotal) return 'idle';
    const mailbox = pickNextMailbox(snapshot.mailboxes);
    if (!mailbox) return 'idle';
    const now = this.clock(), nextDispatchAt = new Date(now.getTime() + computeDispatchDelayMs(this.rng));
    const reservation = await this.repository.claim({ workspaceId, campaignId, mailboxId: mailbox.id, now, nextDispatchAt });
    if (!reservation) return 'idle';
    if (reservation.workspaceId !== workspaceId || reservation.campaignId !== campaignId || reservation.mailboxId !== mailbox.id) {
      throw new Error('Reservation scope mismatch');
    }
    let result: { providerMessageId: string };
    try {
      result = await this.transport.send(reservation);
    } catch {
      await this.repository.finish(workspaceId, reservation.id, 'uncertain');
      return 'uncertain';
    }
    // Do not classify an accepted send as rejected if persisting the receipt
    // fails. Propagate and require reconciliation, never a second automatic send.
    await this.repository.finish(workspaceId, reservation.id, 'accepted', result.providerMessageId);
    return 'accepted';
  }
}
