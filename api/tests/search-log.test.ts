import { describe, expect, it, vi } from 'vitest';

import { SearchLog } from '../src/search-log/search-log';
import { SearchLogConfig } from '../src/search-log/search-log.config';

const BIG = { perMinute: 1e9, burst: 1e9 };

// Rate limits start huge so only the test about them runs into one.
function make(config: Partial<SearchLogConfig> = {}) {
  let now = 1_000_000;
  const countFor = vi.fn((spelling: string) =>
    Promise.resolve(spelling.includes('none') ? 0 : 5),
  );
  const log = new SearchLog({
    clock: () => now,
    countFor,
    config: { ipRate: BIG, clientRate: BIG, ...config },
  });
  const submit = (over: Partial<Parameters<SearchLog['submit']>[0]> = {}) =>
    log.submit({
      term: 'gold',
      submissionId: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      ip: '1.1.1.1',
      ...over,
    });
  return { log, countFor, submit, tick: (ms: number) => (now += ms) };
}

const MINUTE = 60_000;

describe('SearchLog recording', () => {
  it('records the key, spelling, client and server-computed count', async () => {
    const { log, submit } = make();
    const clientId = crypto.randomUUID();

    expect(await submit({ term: ' Gold  ETF ', clientId })).toBe('recorded');

    expect(log.aggregates()).toEqual([
      {
        key: 'etf gold',
        spellings: [
          {
            spelling: 'gold etf',
            display: 'Gold ETF',
            count: 1,
            unfiltered_count: 5,
          },
        ],
        distinct_clients: 1,
        total: 1,
        positive_total: 1,
        has_positive_result: true,
        last_seen: 1_000_000,
      },
    ]);
  });

  it('does not record empty keys or call the counter for them', async () => {
    const { log, submit, countFor } = make();
    expect(await submit({ term: 'the OR' })).toBe('empty-key');
    expect(log.aggregates()).toEqual([]);
    expect(countFor).not.toHaveBeenCalled();
  });

  it('counts each executable spelling once and attributes it to that spelling', async () => {
    const { log, submit, countFor } = make();
    await submit({ term: 'Gold  ETF' });
    await submit({ term: 'gold etf' });
    await submit({ term: 'etf none' });
    await submit({ term: 'none etf' });

    expect(countFor.mock.calls.map(([s]) => s)).toEqual([
      'gold etf',
      'etf none',
      'none etf',
    ]);
    const entry = log.aggregates().find((e) => e.key === 'etf gold');
    expect(entry?.spellings).toEqual([
      {
        spelling: 'gold etf',
        display: 'Gold ETF',
        count: 2,
        unfiltered_count: 5,
      },
    ]);
  });

  it('bounds the count memo, evicting the oldest spelling', async () => {
    const { submit, countFor } = make({ maxMemoSpellings: 1 });
    await submit({ term: 'gold' });
    await submit({ term: 'silver' });
    await submit({ term: 'gold' });
    expect(countFor).toHaveBeenCalledTimes(3);
  });
});

describe('SearchLog idempotency', () => {
  it('ignores a repeated submission_id within 10 minutes', async () => {
    const { log, submit, tick } = make();
    const submissionId = crypto.randomUUID();
    expect(await submit({ submissionId })).toBe('recorded');
    tick(10 * MINUTE - 1);
    expect(await submit({ submissionId })).toBe('duplicate');
    expect(log.aggregates()[0].total).toBe(1);
  });

  it('records the same submission_id again after 10 minutes', async () => {
    const { log, submit, tick } = make();
    const submissionId = crypto.randomUUID();
    await submit({ submissionId });
    tick(10 * MINUTE + 1);
    expect(await submit({ submissionId })).toBe('recorded');
    expect(log.aggregates()[0].total).toBe(2);
  });

  it('keeps at most maxSubmissionIds, evicting the oldest first', async () => {
    const { submit } = make({ maxSubmissionIds: 2 });
    const [a, b, c] = [1, 2, 3].map(() => crypto.randomUUID());
    await submit({ submissionId: a });
    await submit({ submissionId: b });
    await submit({ submissionId: c });

    expect(await submit({ submissionId: c })).toBe('duplicate');
    expect(await submit({ submissionId: a })).toBe('recorded');
  });
});

describe('SearchLog failures and concurrency', () => {
  it('records the retry with the same submission_id after the count failed', async () => {
    const { log, submit, countFor } = make();
    countFor.mockRejectedValueOnce(new Error('boom'));
    const submissionId = crypto.randomUUID();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(submit({ submissionId })).rejects.toThrow('boom');
    expect(log.aggregates()).toEqual([]);

    expect(await submit({ submissionId })).toBe('recorded');
    expect(log.aggregates()[0].total).toBe(1);
  });

  it('records two concurrent submits of one submission_id once', async () => {
    const { log, submit } = make();
    const submissionId = crypto.randomUUID();

    const outcomes = await Promise.all([
      submit({ submissionId }),
      submit({ submissionId }),
    ]);

    expect(outcomes).toEqual(['recorded', 'duplicate']);
    expect(log.aggregates()[0].total).toBe(1);
  });

  it('fails a concurrent same-ID submit when the first fails, and a later retry records', async () => {
    const { log, submit, countFor } = make();
    countFor.mockRejectedValueOnce(new Error('boom'));
    const submissionId = crypto.randomUUID();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const results = await Promise.allSettled([
      submit({ submissionId }),
      submit({ submissionId }),
    ]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(await submit({ submissionId })).toBe('recorded');
    expect(log.aggregates()[0].total).toBe(1);
  });
});

describe('SearchLog duplicates and rate limits', () => {
  it('lets a concurrent same-ID submit share the attempt instead of being rate limited', async () => {
    const { log, submit } = make({ ipRate: { perMinute: 60, burst: 1 } });
    const submissionId = crypto.randomUUID();

    const outcomes = await Promise.all([
      submit({ submissionId }),
      submit({ submissionId }),
    ]);

    expect(outcomes).toEqual(['recorded', 'duplicate']);
    expect(log.aggregates()[0].total).toBe(1);
  });

  it('does not spend a token on a committed duplicate', async () => {
    const { submit } = make({ ipRate: { perMinute: 60, burst: 2 } });
    const submissionId = crypto.randomUUID();

    expect(await submit({ submissionId })).toBe('recorded');
    expect(await submit({ submissionId })).toBe('duplicate');
    expect(await submit()).toBe('recorded');
    expect(await submit()).toBe('rate-limited');
  });

  it('does not spend a token on an empty key', async () => {
    const { submit } = make({ ipRate: { perMinute: 60, burst: 1 } });

    expect(await submit({ term: 'the OR' })).toBe('empty-key');
    expect(await submit()).toBe('recorded');
  });
});

describe('SearchLog bounds', () => {
  it('saturates distinct clients per key', async () => {
    const { log, submit } = make({ maxClientsPerKey: 2 });
    for (let i = 0; i < 3; i++) {
      await submit();
    }
    expect(log.aggregates()[0]).toMatchObject({
      distinct_clients: 2,
      total: 3,
    });
  });

  it('counts a repeat client once', async () => {
    const { log, submit } = make();
    const clientId = crypto.randomUUID();
    await submit({ clientId });
    await submit({ clientId });
    expect(log.aggregates()[0]).toMatchObject({
      distinct_clients: 1,
      total: 2,
    });
  });

  it('evicts the least-frequent spelling, oldest on ties', async () => {
    const { log, submit } = make({ maxSpellingsPerKey: 2 });
    await submit({ term: 'gold etf' });
    await submit({ term: 'gold etf' });
    await submit({ term: 'etf gold' });
    await submit({ term: 'etf gold gold' });

    expect(log.aggregates()[0].spellings.map((s) => s.spelling)).toEqual([
      'gold etf',
      'etf gold gold',
    ]);
  });

  it('keeps has_positive_result and totals after the positive spelling is evicted', async () => {
    const { log, submit } = make({ maxSpellingsPerKey: 1 });
    await submit({ term: 'etf none' }); // zero results
    await submit({ term: 'none etf' }); // zero results, evicts the first
    const [zeroOnly] = log.aggregates();
    expect(zeroOnly).toMatchObject({ has_positive_result: false, total: 2 });

    // Same key, but the positive spelling is the one evicted.
    const countFor = vi.fn((s: string) => Promise.resolve(s === 'a b' ? 5 : 0));
    const log2 = new SearchLog({
      clock: () => 0,
      countFor,
      config: { ipRate: BIG, clientRate: BIG, maxSpellingsPerKey: 1 },
    });
    const send = (term: string) =>
      log2.submit({
        term,
        submissionId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        ip: 'x',
      });
    await send('a b');
    await send('b a');
    const [entry] = log2.aggregates();
    expect(entry.spellings.map((s) => s.spelling)).toEqual(['b a']);
    expect(entry).toMatchObject({
      has_positive_result: true,
      total: 2,
      positive_total: 1,
    });
  });

  it('evicts keys by lowest distinct clients, then oldest last seen', async () => {
    const { log, submit, tick } = make({ maxKeys: 2 });
    const shared = crypto.randomUUID();
    await submit({ term: 'alpha' }); // 1 client, oldest
    tick(1);
    await submit({ term: 'beta', clientId: shared });
    await submit({ term: 'beta' }); // 2 clients
    tick(1);
    await submit({ term: 'gamma' }); // evicts alpha

    expect(log.aggregates().map((e) => e.key).sort()).toEqual([
      'beta',
      'gamma',
    ]);

    tick(1);
    await submit({ term: 'delta' }); // gamma and delta tie on clients, gamma is older
    expect(log.aggregates().map((e) => e.key).sort()).toEqual([
      'beta',
      'delta',
    ]);
  });
});

describe('SearchLog rate limits', () => {
  it('drops over-limit submissions per IP without recording or registering them', async () => {
    const { log, submit, tick } = make({ ipRate: { perMinute: 60, burst: 1 } });
    const submissionId = crypto.randomUUID();

    expect(await submit()).toBe('recorded');
    expect(await submit({ submissionId })).toBe('rate-limited');
    expect(log.aggregates()[0].total).toBe(1);

    tick(1000);
    expect(await submit({ submissionId })).toBe('recorded');
  });

  it('limits per client ID across IPs', async () => {
    const { submit } = make({ clientRate: { perMinute: 60, burst: 1 } });
    const clientId = crypto.randomUUID();
    expect(await submit({ clientId, ip: '1' })).toBe('recorded');
    expect(await submit({ clientId, ip: '2' })).toBe('rate-limited');
    expect(await submit({ ip: '2' })).toBe('recorded');
  });
});
