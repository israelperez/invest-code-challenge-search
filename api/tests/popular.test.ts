import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { InstrumentsRepository } from '../src/index';
import { popularTerms } from '../src/search-log/popular';
import { KeyAggregate, SearchLog } from '../src/search-log/search-log';

function agg(
  key: string,
  distinct_clients: number,
  total: number,
  spellings: [string, number, number][] = [[key, total, 5]],
): KeyAggregate {
  return {
    key,
    spellings: spellings.map(([spelling, count, unfiltered_count]) => ({
      spelling,
      display: spelling.toUpperCase(),
      count,
      unfiltered_count,
    })),
    distinct_clients,
    total,
    positive_total: total,
    has_positive_result: true,
    last_seen: 0,
  };
}

describe('popularTerms', () => {
  it('ranks by distinct clients, then total, and respects the limit', () => {
    const terms = popularTerms(
      [agg('a', 3, 50), agg('b', 9, 10), agg('c', 3, 60), agg('d', 5, 5)],
      3,
    );
    expect(terms.map((t) => t.key)).toEqual(['b', 'd', 'c']);
    expect(terms[0]).toEqual({ label: 'B', key: 'b', clients: 9 });
  });

  it('needs at least 3 distinct clients', () => {
    expect(popularTerms([agg('a', 2, 99)], 10)).toEqual([]);
  });

  it('excludes keys with an OR token', () => {
    expect(popularTerms([agg('a OR b', 9, 9)], 10)).toEqual([]);
  });

  it('never lists a key with no spelling that returns results', () => {
    expect(popularTerms([agg('zzz', 9, 9, [['zzz', 9, 0]])], 10)).toEqual([]);
  });

  it('labels with the most frequent spelling that returns results, in display form', () => {
    const terms = popularTerms(
      [
        agg('gold etf', 4, 12, [
          ['etf gold none', 7, 0],
          ['etf gold', 2, 5],
          ['gold etf', 3, 5],
        ]),
      ],
      10,
    );
    expect(terms[0].label).toBe('GOLD ETF');
  });
});

describe('SearchLog display form and seed', () => {
  const make = () =>
    new SearchLog({
      clock: () => 0,
      countFor: (s) => Promise.resolve(s.includes('none') ? 0 : 5),
      config: { ipRate: { perMinute: 1, burst: 1 } },
    });

  it('shows the most common original casing, trimmed and collapsed', async () => {
    const log = make();
    await log.seed([
      { term: ' vanguard  etf ', clients: 1, searches: 1 },
      { term: 'Vanguard ETF', clients: 1, searches: 3 },
      { term: 'VANGUARD ETF', clients: 1, searches: 2 },
    ]);
    const [entry] = log.aggregates();
    expect(entry.spellings).toEqual([
      { spelling: 'vanguard etf', display: 'Vanguard ETF', count: 6, unfiltered_count: 5 },
    ]);
  });

  it('bounds the casings kept per spelling', async () => {
    const log = new SearchLog({
      clock: () => 0,
      countFor: () => Promise.resolve(1),
      config: { maxCasingsPerSpelling: 1 },
    });
    await log.seed([
      { term: 'Gold', clients: 1, searches: 1 },
      { term: 'GOLD', clients: 1, searches: 5 },
    ]);
    expect(log.aggregates()[0].spellings[0].display).toBe('Gold');
  });

  it('adds nothing when a later count fails', async () => {
    const log = new SearchLog({
      clock: () => 0,
      countFor: (s) => (s === 'bad' ? Promise.reject(new Error('down')) : Promise.resolve(5)),
    });
    await expect(
      log.seed([
        { term: 'good', clients: 3, searches: 3 },
        { term: 'bad', clients: 3, searches: 3 },
      ]),
    ).rejects.toThrow('down');
    expect(log.aggregates()).toEqual([]);
  });

  it('seeds past the rate limits through normal aggregation with real counts', async () => {
    const log = make();
    await log.seed([
      { term: 'A200', clients: 4, searches: 9 },
      { term: 'a200', clients: 4, searches: 2 },
      { term: 'nothing none', clients: 5, searches: 5 },
    ]);
    const byKey = Object.fromEntries(log.aggregates().map((a) => [a.key, a]));
    expect(byKey['a200'].total).toBe(11);
    expect(byKey['a200'].distinct_clients).toBe(6);
    expect(byKey['none nothing'].spellings[0].unfiltered_count).toBe(0);
  });
});

describe('seed file through the default app', () => {
  it('serves 15 popular terms once seeded', async () => {
    // No injected log: the app builds and seeds its own from the real instruments.
    const res = await request(createApp().callback()).get('/popular?limit=15');
    expect(res.status).toBe(200);
    expect(res.body.terms).toHaveLength(15);
  });
});

describe('GET /popular', () => {
  const repository: InstrumentsRepository = {
    getAll: () => Promise.resolve([]),
    getIndexedAt: () => Promise.resolve(1),
  };
  const setup = async () => {
    const searchLog = new SearchLog({
      clock: () => 0,
      countFor: () => Promise.resolve(2),
    });
    await searchLog.seed([{ term: 'Gold', clients: 3, searches: 4 }]);
    return request(createApp({ repository, searchLog }).callback());
  };

  it('returns the terms and the demo-data flag', async () => {
    const res = await (await setup()).get('/popular?limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      terms: [{ label: 'Gold', key: 'gold', clients: 3 }],
      includes_seed_data: true,
    });
  });

  it('defaults the limit', async () => {
    expect((await (await setup()).get('/popular')).status).toBe(200);
  });

  it.each(['limit=0', 'limit=51', 'limit=x', 'limit=1.5', 'limit=1&limit=2', 'foo=1'])(
    'rejects %s with 400',
    async (query) => {
      expect((await (await setup()).get(`/popular?${query}`)).status).toBe(400);
    },
  );
});
