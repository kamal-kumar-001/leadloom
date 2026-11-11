/**
 * Bounded exponential backoff for poll scheduling. A mailbox whose server is
 * down or refusing connections must not be hammered on every tick: each
 * consecutive failure doubles the delay (with jitter) up to a cap, and one
 * success resets the sequence. Deterministic when `jitter` is 0 or a `random`
 * source is injected, which is how the tests drive it.
 */
export interface BackoffOptions {
  /** Delay after the first failure, ms. Default 30s. */
  initialMs?: number;
  /** Upper bound, ms. Default 15min. */
  maxMs?: number;
  /** Multiplier per consecutive failure. Default 2. */
  factor?: number;
  /** Random fraction of the delay added as jitter, 0..1. Default 0.2. */
  jitter?: number;
  /** Injectable randomness for tests; defaults to Math.random. */
  random?: () => number;
}

export class PollBackoff {
  private failures = 0;
  private readonly initialMs: number;
  private readonly maxMs: number;
  private readonly factor: number;
  private readonly jitter: number;
  private readonly random: () => number;

  constructor(options: BackoffOptions = {}) {
    this.initialMs = options.initialMs ?? 30_000;
    this.maxMs = options.maxMs ?? 15 * 60_000;
    this.factor = options.factor ?? 2;
    this.jitter = options.jitter ?? 0.2;
    this.random = options.random ?? Math.random;
    if (this.initialMs <= 0) throw new Error('initialMs must be positive');
    if (this.maxMs < this.initialMs) throw new Error('maxMs must be >= initialMs');
    if (this.factor < 1) throw new Error('factor must be >= 1');
  }

  /** Delay to wait before the next attempt after a failure. */
  recordFailure(): number {
    this.failures++;
    const base = Math.min(this.maxMs, this.initialMs * this.factor ** (this.failures - 1));
    return Math.round(base * (1 + this.jitter * this.random()));
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  /** 0 means the next poll may run immediately. */
  currentFailures(): number {
    return this.failures;
  }
}
