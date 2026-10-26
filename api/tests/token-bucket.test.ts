import { describe, expect, it } from 'vitest';

import { TokenBucket } from '../src/search-log/token-bucket';

describe('TokenBucket', () => {
  const make = (maxKeys?: number) => {
    let now = 0;
    const bucket = new TokenBucket(
      { perMinute: 60, burst: 2 },
      () => now,
      maxKeys,
    );
    return { bucket, tick: (ms: number) => (now += ms) };
  };

  it('allows a burst, then refills at the per-minute rate', () => {
    const { bucket, tick } = make();
    expect(bucket.take('ip')).toBe(true);
    expect(bucket.take('ip')).toBe(true);
    expect(bucket.take('ip')).toBe(false);

    tick(1000);
    expect(bucket.take('ip')).toBe(true);
    expect(bucket.take('ip')).toBe(false);
  });

  it('never refills past the burst', () => {
    const { bucket, tick } = make();
    tick(10 * 60_000);
    expect(bucket.take('ip')).toBe(true);
    expect(bucket.take('ip')).toBe(true);
    expect(bucket.take('ip')).toBe(false);
  });

  it('limits each key on its own', () => {
    const { bucket } = make();
    bucket.take('a');
    bucket.take('a');
    expect(bucket.take('a')).toBe(false);
    expect(bucket.take('b')).toBe(true);
  });

  it('forgets the oldest key past the key cap', () => {
    const { bucket } = make(1);
    bucket.take('a');
    bucket.take('a');
    bucket.take('b');
    expect(bucket.take('a')).toBe(true);
  });
});
