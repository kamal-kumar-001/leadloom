import { BudgetExhaustedError } from './errors';
import { TokenUsage } from './types';

/**
 * In-memory per-owner token accounting across runs and connectors.
 * Session-only (like the draft store): gone on restart, no DB. The point is
 * the user's ask: never silently blow through a coding-agent usage limit.
 */
export class TokenBudget {
  private spent = new Map<string, number>();

  /** Throws BudgetExhaustedError if `ceiling` tokens would be exceeded. */
  assertWithin(ownerKey: string, ceiling: number): void {
    if ((this.spent.get(ownerKey) ?? 0) >= ceiling) {
      throw new BudgetExhaustedError(this.spent.get(ownerKey) ?? 0, ceiling);
    }
  }

  record(ownerKey: string, usage: TokenUsage): number {
    const next = (this.spent.get(ownerKey) ?? 0) + usage.totalTokens;
    this.spent.set(ownerKey, next);
    return next;
  }

  spentBy(ownerKey: string): number {
    return this.spent.get(ownerKey) ?? 0;
  }

  clear(): void {
    this.spent.clear();
  }
}
