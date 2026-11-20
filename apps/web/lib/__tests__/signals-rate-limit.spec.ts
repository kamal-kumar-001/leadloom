import { describe, expect, it } from 'vitest';
import {
  acquireInFlight,
  checkRateLimit,
  releaseInFlight,
  resetRateLimits,
} from '../signals-rate-limit';

describe('checkRateLimit (injected clock)', () => {
  it('allows up to the limit inside the window, then refuses with Retry-After', () => {
    resetRateLimits();
    let now = 1_000_000;
    const clock = () => now;
    for (let i = 0; i < 6; i++) {
      expect(checkRateLimit('u1', 6, 60_000, clock).allowed).toBe(true);
    }
    const blocked = checkRateLimit('u1', 6, 60_000, clock);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it('frees capacity as the window slides', () => {
    resetRateLimits();
    let now = 1_000_000;
    const clock = () => now;
    for (let i = 0; i < 6; i++) checkRateLimit('u1', 6, 60_000, clock);
    now += 61_000;
    expect(checkRateLimit('u1', 6, 60_000, clock).allowed).toBe(true);
  });

  it('isolates keys: one user bursting does not consume another user\'s budget', () => {
    resetRateLimits();
    const clock = () => 1_000_000;
    for (let i = 0; i < 6; i++) checkRateLimit('u1', 6, 60_000, clock);
    expect(checkRateLimit('u2', 6, 60_000, clock).allowed).toBe(true);
  });
});

describe('in-flight concurrency guard', () => {
  it('blocks a second concurrent request and frees the slot on release', () => {
    resetRateLimits();
    expect(acquireInFlight('u1', 1)).toBe(true);
    expect(acquireInFlight('u1', 1)).toBe(false);
    releaseInFlight('u1');
    expect(acquireInFlight('u1', 1)).toBe(true);
    releaseInFlight('u1');
  });

  it('release is balanced: over-release does not go negative', () => {
    resetRateLimits();
    acquireInFlight('u1', 1);
    releaseInFlight('u1');
    releaseInFlight('u1');
    expect(acquireInFlight('u1', 1)).toBe(true);
    releaseInFlight('u1');
  });
});
