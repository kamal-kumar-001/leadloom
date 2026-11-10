import type { DnsStatus } from '@leadloom/contracts';

/**
 * Mailbox rotation & human-jitter dispatch policy (Gamma queue #3 core).
 * Pure, deterministic-with-injected-randomness policy functions; the BullMQ
 * dispatch loop calls these and sleeps for the returned delay. Keeping the
 * policy pure makes the 45-180s jitter and rotation rules unit-testable
 * without Redis.
 */

export interface RotatableMailbox {
  id: string;
  isPaused: boolean;
  healthScore: number;
  sentToday: number;
  dailySendLimit: number;
  lastSentAt?: Date | null;
}

export const MIN_HEALTH_SCORE = 100; // conservative eligibility filter, not a send authorization
export const JITTER_MIN_MS = 45_000;
export const JITTER_MAX_MS = 180_000;

/**
 * Pick the next sending mailbox: healthy, unpaused, under its daily limit,
 * preferring the least-recently used account so volume spreads across the pool.
 * Returns null when no mailbox may send right now.
 */
export function pickNextMailbox(
  pool: RotatableMailbox[],
  minHealthScore: number = MIN_HEALTH_SCORE,
): RotatableMailbox | null {
  const eligible = pool.filter(
    (m) =>
      !m.isPaused &&
      Number.isFinite(m.healthScore) && m.healthScore >= minHealthScore &&
      Number.isInteger(m.sentToday) && m.sentToday >= 0 &&
      Number.isInteger(m.dailySendLimit) && m.dailySendLimit > 0 &&
      m.sentToday < m.dailySendLimit,
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const at = a.lastSentAt?.getTime() ?? 0;
    const bt = b.lastSentAt?.getTime() ?? 0;
    if (at !== bt) return at - bt;
    return b.healthScore - a.healthScore; // tiebreak: healthier first
  });
  return eligible[0];
}

/**
 * Randomized human-like delay between dispatches, uniform in [45s, 180s].
 * `rng` injects randomness so tests can pin the boundaries.
 */
export function computeDispatchDelayMs(rng: () => number = Math.random): number {
  const sample = rng();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("RNG must return a finite value in [0, 1)");
  const r = sample;
  return Math.floor(JITTER_MIN_MS + r * (JITTER_MAX_MS - JITTER_MIN_MS));
}

/** SPF/DKIM/DMARC statuses -> score, mirroring DeliverabilityService weights. */
export function healthScoreFromStatuses(spf: DnsStatus, dkim: DnsStatus, dmarc: DnsStatus): number {
  return (spf === 'verified' ? 34 : 0) + (dkim === 'verified' ? 33 : 0) + (dmarc === 'verified' ? 33 : 0);
}
