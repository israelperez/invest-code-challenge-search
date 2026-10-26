import { describe, expect, it, vi } from 'vitest';
import { createPopularSource } from './popular-source';

const terms = [{ label: 'A200', key: 'a200', clients: 9 }];

describe('PopularSource', () => {
  it('fetches once with the limit and shares the result', async () => {
    const popular = vi.fn(async (_limit: number) => ({ terms, includes_seed_data: true as const }));
    const source = createPopularSource({ popular }, { limit: 10 });

    expect(await source.terms()).toEqual(terms);
    expect(await source.terms()).toEqual(terms);
    expect(popular).toHaveBeenCalledTimes(1);
    expect(popular).toHaveBeenCalledWith(10);
  });

  it('forgets a failure so the next call retries', async () => {
    const popular = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ terms, includes_seed_data: true });
    const source = createPopularSource({ popular }, { limit: 10 });

    await expect(source.terms()).rejects.toThrow('down');
    expect(await source.terms()).toEqual(terms);
  });
});
