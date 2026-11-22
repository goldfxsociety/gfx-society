/**
 * Subrequest meter. Cloudflare Workers Free allows 50 subrequests per invocation, and D1 allows 50 queries per
 * invocation on Free. To be safe regardless of how they are counted, we count Discord REST calls, CDN fetches AND
 * D1 statements against ONE pool with a hard cap below 50.
 */
export class BudgetExceeded extends Error {
  constructor() {
    super("subrequest budget exhausted for this invocation");
  }
}

export class Meter {
  used = 0;
  constructor(public readonly limit: number = Number.POSITIVE_INFINITY) {}
  left(): number {
    return this.limit - this.used;
  }
  has(n: number): boolean {
    return this.left() >= n;
  }
  spend(n = 1): void {
    if (this.used + n > this.limit) throw new BudgetExceeded();
    this.used += n;
  }
}

/** Hard cap per cron tick (fetch + D1 combined), leaving headroom under 50. */
export const CRON_BUDGET = 45;
