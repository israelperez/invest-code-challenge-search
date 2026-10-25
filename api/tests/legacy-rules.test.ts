import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { InstrumentDocument, InstrumentsRepository } from '../src/index';

// Characterises the legacy rules on a small in-memory catalogue, so the data is under control.
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

// Default order: BET1, BET2, then AA0, AAA, ABC, ABCD, MID, NOU, QQQ, XYZ.
const documents = [
  doc('XYZ', {
    display_name: 'Australia 200 Index',
    issuer: 'vanguard',
    is_portfolio_excluded: true,
  }),
  doc('QQQ', { issuer: 'vaneck', is_flagship_fund: true }),
  doc('ABC', {
    kind: 'equity',
    units_circulating: '100',
    is_flagship_fund: true,
  }),
  doc('ABCD', { display_name: 'Alpha Bank Fund', units_circulating: '200' }),
  doc('AAA', { display_name: 'Abc Trust' }),
  doc('AA0', { issuer: 'abc' }),
  doc('MID', { units_circulating: '50', is_auto_invest_included: true }),
  doc('NOU', {
    kind: 'equity',
    symbol_openfigi: 'ABC',
    is_auto_invest_included: true,
  }),
  doc('BET1', {
    display_name: 'Betashares Gold',
    issuer: 'betashares',
    is_betashares: true,
    is_auto_invest_included: true,
  }),
  doc('BET2', {
    display_name: 'Betashares Bank',
    issuer: 'betashares',
    is_betashares: true,
    units_circulating: '300',
  }),
];
const defaultOrder = [
  'BET1',
  'BET2',
  'AA0',
  'AAA',
  'ABC',
  'ABCD',
  'MID',
  'NOU',
  'QQQ',
  'XYZ',
];

const repository: InstrumentsRepository = {
  getAll: () => Promise.resolve(documents),
  getIndexedAt: () => Promise.resolve(1234),
};
const api = request(createApp({ repository }).callback());

const search = (body: object = {}, query = '') =>
  api.post(`/search${query}`).send(body);
const symbols = async (body: object = {}) =>
  (await search(body)).body.results.map((r: InstrumentDocument) => r.symbol);

describe('text search ranking', () => {
  it('ranks exact ticker, ticker prefix, name words, then other field words', async () => {
    // ABC exact ticker and NOU exact openfigi (4), ABCD prefix (3), AAA name "Abc Trust" (2), AA0 issuer "abc" (1).
    expect(await symbols({ search_text: 'abc' })).toEqual([
      'ABC',
      'NOU',
      'ABCD',
      'AAA',
      'AA0',
    ]);
  });

  it('matches an exact symbol_openfigi', async () => {
    expect(await symbols({ search_text: 'xyz:au' })).toEqual(['XYZ']);
  });

  it('needs every word in the name, in any order', async () => {
    expect(await symbols({ search_text: '200 australia' })).toEqual(['XYZ']);
  });

  it('keeps the default order between equal scores', async () => {
    expect(await symbols({ search_text: 'bank' })).toEqual(['BET2', 'ABCD']);
  });

  it('searches either side of an uppercase OR', async () => {
    expect(await symbols({ search_text: 'xyz OR mid' })).toEqual([
      'MID',
      'XYZ',
    ]);
  });

  it('does not treat a lowercase or as an alternative', async () => {
    expect((await search({ search_text: 'xyz or mid' })).body.count).toBe(0);
  });
});

describe('filters', () => {
  it('matches multi-select values ignoring case', async () => {
    expect(await symbols({ issuer: ['VANGUARD', 'Vaneck'] })).toEqual([
      'QQQ',
      'XYZ',
    ]);
    expect(await symbols({ kind: ['EQUITY'] })).toEqual(['ABC', 'NOU']);
  });

  it('applies a boolean filter, and none for a null value', async () => {
    expect(await symbols({ is_betashares: { value: true } })).toEqual([
      'BET1',
      'BET2',
    ]);
    expect((await search({ is_betashares: { value: false } })).body.count).toBe(
      8,
    );
    expect((await search({ is_betashares: { value: null } })).body.count).toBe(
      10,
    );
  });

  // Each flag has a different set of instruments, so a filter mapped to the wrong flag fails.
  it.each([
    [
      'is_flagship_fund',
      ['ABC', 'QQQ'],
      ['BET1', 'BET2', 'AA0', 'AAA', 'ABCD', 'MID', 'NOU', 'XYZ'],
    ],
    [
      'is_portfolio_excluded',
      ['XYZ'],
      ['BET1', 'BET2', 'AA0', 'AAA', 'ABC', 'ABCD', 'MID', 'NOU', 'QQQ'],
    ],
    [
      'is_auto_invest_included',
      ['BET1', 'MID', 'NOU'],
      ['BET2', 'AA0', 'AAA', 'ABC', 'ABCD', 'QQQ', 'XYZ'],
    ],
  ])('applies the %s filter', async (field, yes, no) => {
    expect(await symbols({ [field]: { value: true } })).toEqual(yes);
    expect(await symbols({ [field]: { value: false } })).toEqual(no);
  });

  it('matches symbol_openfigi values ignoring case', async () => {
    expect(await symbols({ symbol_openfigi: ['xyz:au', 'Abcd:AU'] })).toEqual([
      'ABCD',
      'XYZ',
    ]);
  });

  it('applies range bounds inclusively and excludes missing values', async () => {
    expect(
      await symbols({ units_circulating: { min: '100', max: '200' } }),
    ).toEqual(['ABC', 'ABCD']);
    expect(await symbols({ units_circulating: { min: '200' } })).toEqual([
      'BET2',
      'ABCD',
    ]);
    expect(await symbols({ units_circulating: { max: '50' } })).toEqual([
      'MID',
    ]);
  });

  it('applies no range filter for empty bounds', async () => {
    const res = await search({ units_circulating: { min: '', max: null } });
    expect(res.body.count).toBe(10);
  });
});

describe('order_by', () => {
  const nulls = ['BET1', 'AA0', 'AAA', 'NOU', 'QQQ', 'XYZ'];

  it('orders range fields numerically, missing values last', async () => {
    expect(await symbols({ order_by: 'units_circulating.asc' })).toEqual([
      'MID',
      'ABC',
      'ABCD',
      'BET2',
      ...nulls,
    ]);
    expect(await symbols({ order_by: 'units_circulating.desc' })).toEqual([
      'BET2',
      'ABCD',
      'ABC',
      'MID',
      ...nulls,
    ]);
  });

  it('defaults the direction to desc', async () => {
    expect(await symbols({ order_by: 'units_circulating' })).toEqual(
      await symbols({ order_by: 'units_circulating.desc' }),
    );
  });

  it('orders text fields', async () => {
    expect((await symbols({ order_by: 'symbol.asc' })).slice(0, 4)).toEqual([
      'AA0',
      'AAA',
      'ABC',
      'ABCD',
    ]);
  });

  it('leaves the order unchanged for an unknown field', async () => {
    expect(await symbols({ order_by: 'nope.asc' })).toEqual(defaultOrder);
  });
});

describe('paging', () => {
  it('returns the requested page and counts before pagination', async () => {
    const res = await search({ from: 2, size: 3 });
    expect(res.body.results.map((r: InstrumentDocument) => r.symbol)).toEqual([
      'AAA',
      'ABC',
      'ABCD',
    ]);
    expect(res.body.count).toBe(10);
  });

  it('returns no results past the last page', async () => {
    const res = await search({ from: 5, size: 3 });
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(10);
  });

  it('reports indexed_at from the repository', async () => {
    expect((await search()).body.indexed_at).toBe(1234);
  });
});

describe('fields', () => {
  it('returns only the requested fields', async () => {
    const res = await search({ size: 1 }, '?fields=symbol, kind');
    expect(res.body.results).toEqual([{ symbol: 'BET1', kind: 'etf' }]);
  });

  it('returns the whole document when no requested field exists', async () => {
    const res = await search({ size: 1 }, '?fields=nope');
    expect(res.body.results).toEqual([documents[8]]);
  });
});

describe('/instruments/:id', () => {
  it('finds an instrument ignoring case', async () => {
    const res = await api.get('/instruments/abcd:au');
    expect(res.body).toEqual(documents[3]);
  });

  it('picks fields', async () => {
    const res = await api.get('/instruments/ABC:AU?fields=symbol');
    expect(res.body).toEqual({ symbol: 'ABC' });
  });

  it('answers 404 with the id in the message', async () => {
    const res = await api.get('/instruments/nope:au');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Instrument not found: nope:au' });
  });
});

describe('/facets/:key', () => {
  it('replaces its own filter, so other values keep their counts', async () => {
    const res = await api.post('/facets/kind').send({ kind: ['etf'] });
    expect(res.body).toEqual([
      { value: 'equity', count: 2 },
      { value: 'etf', count: 8 },
    ]);
  });

  it('applies the other filters in the body', async () => {
    const res = await api
      .post('/facets/kind')
      .send({ is_flagship_fund: { value: true } });
    expect(res.body).toEqual([
      { value: 'equity', count: 1 },
      { value: 'etf', count: 1 },
    ]);
  });

  it('omits empty counts only when asked', async () => {
    const body = { search_text: 'mid' };
    expect((await api.post('/facets/kind').send(body)).body).toEqual([
      { value: 'equity', count: 0 },
      { value: 'etf', count: 1 },
    ]);
    const omitted = await api
      .post('/facets/kind?omit_empty_counts=true')
      .send(body);
    expect(omitted.body).toEqual([{ value: 'etf', count: 1 }]);
  });

  it('returns an empty list for an unknown key', async () => {
    expect((await api.post('/facets/nope').send({})).body).toEqual([]);
  });
});

describe('validation', () => {
  const rejected: [string, unknown, string][] = [
    ['a non-object body', [], 'Request body must be a JSON object'],
    ['search_text', { search_text: 1 }, 'search_text must be a string'],
    ['order_by', { order_by: 1 }, 'order_by must be a string'],
    ['from', { from: -1 }, 'from must be an integer >= 0'],
    ['size', { size: 1.5 }, 'size must be an integer >= 0'],
    ['a multi-select', { kind: 'etf' }, 'kind must be an array of strings'],
    [
      'a boolean',
      { is_betashares: { value: 'yes' } },
      'is_betashares must be an object like { "value": true }',
    ],
    [
      'a range',
      { units_circulating: 5 },
      'units_circulating must be an object like { "min": "0", "max": "100" }',
    ],
    [
      'a range min',
      { units_circulating: { min: 'abc' } },
      'units_circulating.min must be a numeric string',
    ],
    [
      'a range max',
      { units_circulating: { max: 5 } },
      'units_circulating.max must be a numeric string',
    ],
  ];

  it.each(rejected)('rejects %s with 400', async (_name, body, message) => {
    for (const path of ['/search', '/facets/kind']) {
      const res = await api.post(path).send(body as object);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message });
    }
  });
});

describe('quirks pinned as they are', () => {
  it('treats from: 0 as page 1', async () => {
    expect(await symbols({ from: 0, size: 3 })).toEqual(
      await symbols({ from: 1, size: 3 }),
    );
  });

  it('ignores unknown body keys', async () => {
    expect(await symbols({ nope: 1, kind: ['equity'] })).toEqual(
      await symbols({ kind: ['equity'] }),
    );
  });

  it('includes values exactly on a range bound', async () => {
    expect(
      await symbols({ units_circulating: { min: '100', max: '100' } }),
    ).toEqual(['ABC']);
  });
});
