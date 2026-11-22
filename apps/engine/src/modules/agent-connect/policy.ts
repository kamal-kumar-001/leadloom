import { ExecFn } from './types';

/**
 * Bounds on a single agent run. The token ceiling (TokenBudget) only stops
 * FUTURE runs once spend is known - a run's usage is reported after it
 * completes, so it cannot hard-cap the run in flight. These bounds are the
 * hard limits on the run itself: wall-clock time, captured output size, and
 * how many runs may be in flight per connector instance.
 */
export interface RunPolicy {
  timeoutSeconds: number;
  maxStdoutBytes: number;
  maxConcurrent: number;
}

export const DEFAULT_RUN_POLICY: RunPolicy = {
  timeoutSeconds: 300,
  maxStdoutBytes: 4 * 1024 * 1024,
  maxConcurrent: 1,
};

export class RunTimeoutError extends Error {
  constructor(seconds: number) {
    super(`agent run exceeded ${seconds}s timeout`);
    this.name = 'RunTimeoutError';
  }
}

export class OutputLimitError extends Error {
  constructor(limit: number) {
    super(`agent stdout exceeded ${limit} bytes; refusing to parse truncated output`);
    this.name = 'OutputLimitError';
  }
}

/** Wraps an ExecFn with hard timeout and output-size enforcement. */
export function guardedExec(exec: ExecFn, policy: RunPolicy): ExecFn {
  return async (file, args, options) => {
    const result = await Promise.race([
      exec(file, args, options),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new RunTimeoutError(policy.timeoutSeconds)), policy.timeoutSeconds * 1000)),
    ]);
    if (Buffer.byteLength(result.stdout, 'utf8') > policy.maxStdoutBytes) {
      throw new OutputLimitError(policy.maxStdoutBytes);
    }
    return result;
  };
}

/** Promise-based semaphore: at most `max` runs in flight, FIFO. */
export class ConcurrencyGate {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly max: number) {}

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.max <= 1) {
      const prev = this.queue;
      let release!: () => void;
      this.queue = new Promise<void>((res) => { release = res; });
      await prev;
      try {
        return await fn();
      } finally {
        release();
      }
    }
    return fn(); // maxConcurrent > 1 not needed yet; single-flight is the safe default
  }
}
