import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { SearchLog } from '../src/search-log/search-log';
import { InstrumentDocument, InstrumentsRepository } from '../src/index';

// Tests the facets of POST /search/index on a small in-memory catalogue, plus parity with /facets on real data.
const doc = (
  symbol: string,
  overrides: Partial<InstrumentDocument> = {},
): InstrumentDocument => ({
  symbol,
  symbol_openfigi: `${symbol}:AU`,
  display_name: 'Plain Fund',
  kind: 'etf',
  currency: 'AUD',
  logo: null,
  issuer: 'acme',
  is_betashares: false,
  is_flagship_fund: false,
  is_portfolio_excluded: false,
  is_auto_invest_included: false,
  units_circulating: null,
  ...overrides,
});

// B sits on the 100,000,000 bucket edge, so it counts in two buckets.
const documents = [
  doc('A', {
    display_name: 'Alpha Bank',
    is_betashares: true,
    units_circulating: '50',
  }),
  doc('B', { issuer: 'beta', units_circulating: '100000000' }),
  doc('C', {
    display_name: 'Charlie Bank',
    kind: 'equity',
    units_circulating: '600000000',
  }),
  doc('D', { kind: 'equity', issuer: 'gamma', is_betashares: true }),
  doc('E', { issuer: 'gamma', units_circulating: '2000000000' }),
];

const bucketValues = [
  '0,100000000',
  '100000000,500000000',
  '500000000,1000000000',
  '1000000000,5000000000',
  '5000000000,1000000000000',
];
const flags = [
  'is_flagship_fund',
  'is_portfolio_excluded',
  'is_auto_invest_included',
] as const;

// An injected log starts empty, so seeding doesn't add repository reads.
const makeApi = (repository: InstrumentsRepository) =>
  request(
    createApp({
      repository,
      searchLog: new SearchLog({ clock: () => 0, countFor: async () => 0 }),
    }).callback(),
  );
const repository: InstrumentsRepository = {
  getAll: () => Promise.resolve(documents),
  getIndexedAt: () => Promise.resolve(1234),
};
const api = makeApi(repository);
const facets = async (body: object = {}) => {
  const res = await api
    .post('/search/index')
    .send({ ...body, include: ['facets'] });
  expect(res.status).toBe(200);
  return res.body.facets as Record<string, { value: string; count: number }[]>;
};
const counts = (list: { value: string; count: number }[]) =>
  list.map(({ count }) => count);

// Expected counts per facet, in universe order: kind [equity, etf], issuer [acme, beta, gamma],
// booleans [true, false], then the five units_circulating buckets.
const table = (
  kind: number[],
  issuer: number[],
  betashares: number[],
  flag: number[],
  units: number[],
) => ({
  kind,
  issuer,
  is_betashares: betashares,
  is_flagship_fund: flag,
  is_portfolio_excluded: flag,
  is_auto_invest_included: flag,
  units_circulating: units,
});

describe('POST /search/index facets universe', () => {
  it('returns all 7 keys with every value and explicit zero counts', async () => {
    const result = await facets({ search_text: 'zzz' });
    expect(Object.keys(result)).toHaveLength(7);
    expect(result.kind.map((f) => f.value)).toEqual(['equity', 'etf']);
    expect(result.issuer.map((f) => f.value)).toEqual([
      'acme',
      'beta',
      'gamma',
    ]);
    for (const key of ['is_betashares', ...flags]) {
      expect(result[key].map((f) => f.value)).toEqual(['true', 'false']);
    }
    expect(result.units_circulating.map((f) => f.value)).toEqual(bucketValues);
    expect(
      Object.values(result)
        .flat()
        .every((f) => f.count === 0),
    ).toBe(true);
  });

  it('keeps both boolean values when the data holds only one', async () => {
    const onlyFalse = makeApi({
      getAll: () => Promise.resolve([doc('A')]),
      getIndexedAt: () => Promise.resolve(1),
    });
    const res = await onlyFalse
      .post('/search/index')
      .send({ include: ['facets'] });
    expect(res.body.facets.is_betashares).toEqual([
      { value: 'true', count: 0 },
      { value: 'false', count: 1 },
    ]);
  });
});

describe('POST /search/index facets counts', () => {
  const noFilters = table([2, 3], [2, 1, 2], [2, 3], [0, 5], [2, 1, 1, 1, 0]);

  const cases: [string, object, ReturnType<typeof table>][] = [
    ['no filters', {}, noFilters],
    [
      'one kind: kind ignores its own filter, others narrow',
      { kind: ['etf'] },
      table([2, 3], [1, 1, 1], [1, 2], [0, 3], [2, 1, 0, 1, 0]),
    ],
    ['two kinds are ORed', { kind: ['etf', 'equity'] }, noFilters],
    [
      'kind and a boolean: each facet ignores only its own filter',
      { kind: ['etf'], is_betashares: { value: true } },
      table([1, 1], [1, 0, 0], [1, 2], [0, 1], [1, 0, 0, 0, 0]),
    ],
    [
      'a units range: units ignores its own bounds',
      { units_circulating: { min: '100000000', max: '1000000000' } },
      table([1, 1], [1, 1, 0], [0, 2], [0, 2], [2, 1, 1, 1, 0]),
    ],
    [
      'search_text with a filter',
      { search_text: 'bank', kind: ['equity'] },
      table([1, 1], [1, 0, 0], [0, 1], [0, 1], [0, 0, 1, 0, 0]),
    ],
  ];

  it.each(cases)('%s', async (_name, body, expected) => {
    const result = await facets(body);
    for (const [key, list] of Object.entries(expected)) {
      expect(counts(result[key]), key).toEqual(list);
    }
  });
});

describe('POST /search/index facets pass count', () => {
  const spied = () => {
    let calls = 0;
    const api = makeApi({
      getAll: () => {
        calls += 1;
        return Promise.resolve(documents);
      },
      getIndexedAt: () => Promise.resolve(1234),
    });
    return { api, calls: () => calls };
  };
  const filters = {
    kind: ['etf'],
    is_betashares: { value: true },
    units_circulating: { min: '1' },
  };

  it('runs one pass plus one per active facet', async () => {
    const { api, calls } = spied();
    await api.post('/search/index').send({ ...filters, include: ['facets'] });
    // One read for the facet options, one pass for the request and one per active facet.
    expect(calls()).toBe(2 + 3);
  });

  it('reads the options and runs one pass when no facet is active', async () => {
    const { api, calls } = spied();
    await api.post('/search/index').send({ include: ['count', 'facets'] });
    expect(calls()).toBe(2);
  });

  it('skips the extra passes without facets in include', async () => {
    const { api, calls } = spied();
    const res = await api
      .post('/search/index')
      .send({ ...filters, include: ['count'] });
    expect(calls()).toBe(1);
    expect(res.body).not.toHaveProperty('facets');
  });
});

describe('POST /search/index facets on real data', () => {
  const real = request(createApp().callback());
  const keys = [
    'kind',
    'issuer',
    'is_betashares',
    'is_flagship_fund',
    'is_portfolio_excluded',
    'is_auto_invest_included',
    'units_circulating',
  ];

  it.each([
    [{}],
    [{ search_text: 'bank' }],
    [{ kind: ['etf'] }],
    [{ kind: ['etf'], is_betashares: { value: true } }],
  ])('matches POST /facets/:key for %j', async (body) => {
    const res = await real
      .post('/search/index')
      .send({ ...body, include: ['facets'] });
    expect(Object.keys(res.body.facets)).toEqual(keys);
    for (const key of keys) {
      const legacy = (await real.post(`/facets/${key}`).send(body)).body;
      // The index always lists both boolean values; /facets drops one absent from the data.
      const index = res.body.facets[key].filter(
        (f: { value: string; count: number }) =>
          legacy.some((l: { value: string }) => l.value === f.value),
      );
      expect(index, key).toEqual(legacy);
    }
  });
});
