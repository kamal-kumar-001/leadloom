import { describe, it, expect } from 'vitest';
import {
  pickNextMailbox,
  computeDispatchDelayMs,
  healthScoreFromStatuses,
  JITTER_MIN_MS,
  JITTER_MAX_MS,
  RotatableMailbox,
} from '../rotation.service';

const box = (overrides: Partial<RotatableMailbox>): RotatableMailbox => ({
  id: 'mb-1',
  isPaused: false,
  healthScore: 100,
  sentToday: 0,
  dailySendLimit: 50,
  lastSentAt: null,
  ...overrides,
});

describe('pickNextMailbox — rotation policy', () => {
  it('skips paused, unhealthy, and exhausted mailboxes', () => {
    const pool = [
      box({ id: 'paused', isPaused: true }),
      box({ id: 'unhealthy', healthScore: 0 }),
      box({ id: 'full', sentToday: 50 }),
      box({ id: 'ok' }),
    ];
    expect(pickNextMailbox(pool)?.id).toBe('ok');
  });

  it('returns null when nobody may send', () => {
    expect(pickNextMailbox([box({ isPaused: true })])).toBeNull();
    expect(pickNextMailbox([])).toBeNull();
  });

  it('prefers the least-recently used mailbox (rotation)', () => {
    const pool = [
      box({ id: 'recent', lastSentAt: new Date('2026-11-10T08:00:00Z') }),
      box({ id: 'stale', lastSentAt: new Date('2026-11-10T06:00:00Z') }),
      box({ id: 'never', lastSentAt: null }),
    ];
    expect(pickNextMailbox(pool)?.id).toBe('never');
    expect(pickNextMailbox(pool.slice(0, 2))?.id).toBe('stale');
  });

  it('breaks last-sent ties by health score', () => {
    const pool = [box({ id: 'weak', healthScore: 67 }), box({ id: 'strong', healthScore: 100 })];
    expect(pickNextMailbox(pool)?.id).toBe('strong');
  });

  it('respects the minimum health threshold', () => {
    expect(pickNextMailbox([box({ healthScore: 33 })])).toBeNull();
    expect(pickNextMailbox([box({ healthScore: 34 })])).toBeNull();
    expect(pickNextMailbox([box({ healthScore: 100 })])?.id).toBe('mb-1');
  });
});

describe('computeDispatchDelayMs — 45-180s human jitter', () => {
  it('stays within bounds at the extremes', () => {
    expect(computeDispatchDelayMs(() => 0)).toBe(JITTER_MIN_MS);
    expect(computeDispatchDelayMs(() => 0.9999999)).toBeLessThanOrEqual(JITTER_MAX_MS);
  });

  it('is monotonic in the rng value', () => {
    expect(computeDispatchDelayMs(() => 0.5)).toBeGreaterThan(computeDispatchDelayMs(() => 0.1));
  });

  it('never leaves [45s, 180s] across random samples', () => {
    for (let i = 0; i < 500; i++) {
      const d = computeDispatchDelayMs();
      expect(d).toBeGreaterThanOrEqual(JITTER_MIN_MS);
      expect(d).toBeLessThanOrEqual(JITTER_MAX_MS);
    }
  });
});

describe('healthScoreFromStatuses', () => {
  it('matches the deliverability service weights', () => {
    expect(healthScoreFromStatuses('verified', 'verified', 'verified')).toBe(100);
    expect(healthScoreFromStatuses('verified', 'failing', 'failing')).toBe(34);
    expect(healthScoreFromStatuses('failing', 'failing', 'failing')).toBe(0);
  });
});
