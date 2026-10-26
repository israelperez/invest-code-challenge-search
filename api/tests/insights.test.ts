import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { InstrumentsRepository } from '../src/index';
import { zeroResultGroups } from '../src/insights/zero-results';
import { KeyAggregate, SearchLog } from '../src/search-log/search-log';
import { envConfig } from '../src/shared/configs/env.config';

function agg(
  key: string,
  distinct_clients: number,
  total: number,
  has_positive_result = false,
  spellings: [string, number][] = [[key, total]],
): KeyAggregate {
  return {
    key,
    spellings: spellings.map(([spelling, count]) => ({
      spelling,
      display: spelling.toUpperCase(),
      count,
      unfiltered_count: 0,
    })),
    distinct_clients,
    total,
    positive_total: has_positive_result ? total : 0,
    has_positive_result,
    last_seen: 0,
  };
}

describe('zeroResultGroups', () => {
  it('keeps keys that never had a result and have at least 2 distinct clients', () => {
    const groups = zeroResultGroups([
      agg('few', 1, 50),
      agg('ok', 2, 3),
      agg('found', 9, 9, true),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['ok']);
  });

  it('shapes a group with clients, total and display spellings, most searched first', () => {
    const [group] = zeroResultGroups([
      agg('gold etf', 4, 9, false, [
        ['etf gold', 2],
        ['gold etf', 7],
      ]),
    ]);
    expect(group).toEqual({
      key: 'gold etf',
      clients: 4,
      total: 9,
      spellings: [
        { text: 'GOLD ETF', total: 7 },
        { text: 'ETF GOLD', total: 2 },
      ],
    });
  });

  it('orders groups by clients, then total', () => {
    const groups = zeroResultGroups([agg('a', 2, 50), agg('b', 5, 5), agg('c', 2, 60)]);
    expect(groups.map((g) => g.key)).toEqual(['b', 'c', 'a']);
  });
});

describe('GET /insights/zero-results', () => {
  const repository: InstrumentsRepository = {
    getAll: () => Promise.resolve([]),
    getIndexedAt: () => Promise.resolve(1),
  };
  const setup = async (enableInsights: boolean) => {
    // Every spelling counts 0 results, so "Nothing" is a zero-result key.
    const searchLog = new SearchLog({
      clock: () => 0,
      countFor: () => Promise.resolve(0),
    });
    await searchLog.seed([
      { term: 'Nothing', clients: 3, searches: 4 },
      { term: 'Solo', clients: 1, searches: 4 },
    ]);
    return request(
      createApp({ repository, searchLog, config: { ...envConfig, enableInsights } }).callback(),
    );
  };

  it('returns the groups and the demo-data flag when enabled', async () => {
    const res = await (await setup(true)).get('/insights/zero-results');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      groups: [
        { key: 'nothing', clients: 3, total: 4, spellings: [{ text: 'Nothing', total: 4 }] },
      ],
      includes_seed_data: true,
    });
  });

  it('does not exist when disabled', async () => {
    expect((await (await setup(false)).get('/insights/zero-results')).status).toBe(404);
  });
});
