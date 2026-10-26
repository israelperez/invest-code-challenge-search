export interface BucketRate {
  perMinute: number;
  burst: number;
}

/**
 * Token buckets keyed by string (an IP or a client ID). Each key starts full and refills continuously.
 */
export class TokenBucket {
  private buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private rate: BucketRate,
    private clock: () => number,
    // Spoofed keys must not grow memory without bound; the oldest bucket is forgotten (and so reset).
    private maxKeys = 10_000,
  ) {}

  take(key: string): boolean {
    const now = this.clock();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.rate.burst,
      at: now,
    };
    bucket.tokens = Math.min(
      this.rate.burst,
      bucket.tokens + ((now - bucket.at) * this.rate.perMinute) / 60_000,
    );
    bucket.at = now;

    // Re-insert so the Map's first key is the least recently used.
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
    if (this.buckets.size > this.maxKeys) {
      this.buckets.delete(this.buckets.keys().next().value as string);
    }

    if (bucket.tokens < 1) {
      return false;
    }
    bucket.tokens -= 1;
    return true;
  }
}
