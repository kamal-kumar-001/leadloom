export class AuthorityDeniedError extends Error {
  constructor(reason: string) {
    super(`Authority denied: ${reason}`);
    this.name = 'AuthorityDeniedError';
  }
}

export class BudgetExhaustedError extends Error {
  constructor(spent: number, budget: number) {
    super(`Token budget exhausted: ${spent}/${budget} tokens already spent`);
    this.name = 'BudgetExhaustedError';
  }
}
