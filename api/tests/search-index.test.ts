import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { InstrumentDocument, InstrumentsRepository } from '../src/index';

// Tests POST /search/index and GET /version on a small in-memory catalogue, plus a few real-data checks.
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

// DUP is listed on two markets, higher symbol_openfigi first. Then T00..T19 and one equity.
const documents = [
  doc('DUP', { symbol_openfigi: 'DUP:US' }),
  doc('DUP', { symbol_openfigi: 'DUP:AU' }),
  ...Array.from({ length: 20 }, (_, i) =>
    doc(`T${String(i).padStart(2, '0')}`),
  ),
  doc('EQ', { kind: 'equity' }),
];
// Default order is by symbol: DUP, DUP, EQ, T00..T19. Index order breaks the DUP tie by id.
const ids = [
  'DUP:AU',
  'DUP:US',
  'EQ:AU',
  ...Array.from({ length: 20 }, (_, i) => `T${String(i).padStart(2, '0')}:AU`),
];

const repository: InstrumentsRepository = {
  getAll: () => Promise.resolve(documents),
  getIndexedAt: () => Promise.resolve(1234),
};
const api = request(createApp({ repository }).callback());
const post = (body: unknown = {}) =>
  api.post('/search/index').send(body as object);

describe('POST /search/index include', () => {
  it('returns count, ids, next_id_offset, documents and indexed_at by default', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body.indexed_at).toBe(1234);
    expect(res.body.count).toBe(23);
    expect(res.body.ids).toEqual(ids);
    expect(res.body.next_id_offset).toBeNull();
    expect(res.body.documents).toHaveLength(15);
    expect(
      res.body.documents.map((d: InstrumentDocument) => d.symbol_openfigi),
    ).toEqual(ids.slice(0, 15));
    expect(res.body.facets).toBeDefined();
    expect(Object.keys(res.body.facets)).toHaveLength(7);
  });

  it.each([
    [['count'], ['count']],
    [['ids'], ['ids', 'next_id_offset']],
    [
      ['count', 'ids'],
      ['count', 'ids', 'next_id_offset'],
    ],
    [
      ['ids', 'documents'],
      ['documents', 'ids', 'next_id_offset'],
    ],
    [
      ['count', 'ids', 'documents'],
      ['count', 'documents', 'ids', 'next_id_offset'],
    ],
    [
      ['count', 'facets'],
      ['count', 'facets'],
    ],
    [['facets'], ['facets']],
    [[], []],
  ])('include %j returns only %j plus indexed_at', async (include, keys) => {
    const res = await post({ include });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [...keys, 'indexed_at'].sort(),
    );
  });

  it('deduplicates include', async () => {
    const res = await post({ include: ['ids', 'count', 'ids', 'count'] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual((await post({ include: ['count', 'ids'] })).body);
  });

  it.each([['documents'], ['count', 'documents']])(
    'rejects documents without ids (%s)',
    async (...include) => {
      const res = await post({ include });
      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(expect.any(String));
    },
  );

  it('ignores the window fields when ids is excluded', async () => {
    const res = await post({
      include: ['count'],
      id_offset: 5,
      id_limit: 2,
      document_limit: 3,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ indexed_at: 1234, count: 23 });
  });
});

describe('POST /search/index window', () => {
  it('pages through the ids with next_id_offset and a snapshot', async () => {
    const first = await post({ id_limit: 10 });
    expect(first.body.ids).toEqual(ids.slice(0, 10));
    expect(first.body.next_id_offset).toBe(10);
    expect(first.body.documents).toHaveLength(10);

    const second = await post({ id_limit: 10, id_offset: 10, snapshot: 1234 });
    expect(second.status).toBe(200);
    expect(second.body.ids).toEqual(ids.slice(10, 20));
    expect(second.body.next_id_offset).toBe(20);

    const last = await post({ id_limit: 10, id_offset: 20, snapshot: 1234 });
    expect(last.body.ids).toEqual(ids.slice(20));
    expect(last.body.next_id_offset).toBeNull();
    expect(last.body.documents).toHaveLength(3);
  });

  it('returns documents for the first ids of the window only', async () => {
    const res = await post({ id_offset: 3, id_limit: 5, snapshot: 1234 });
    expect(
      res.body.documents.map((d: InstrumentDocument) => d.symbol_openfigi),
    ).toEqual(ids.slice(3, 8));
    const limited = await post({
      id_offset: 3,
      id_limit: 5,
      document_limit: 2,
      snapshot: 1234,
    });
    expect(limited.body.ids).toEqual(ids.slice(3, 8));
    expect(
      limited.body.documents.map((d: InstrumentDocument) => d.symbol_openfigi),
    ).toEqual(ids.slice(3, 5));
  });

  it('returns empty ids and a null next_id_offset past the end', async () => {
    const res = await post({ id_offset: 500, snapshot: 1234 });
    expect(res.status).toBe(200);
    expect(res.body.ids).toEqual([]);
    expect(res.body.next_id_offset).toBeNull();
    expect(res.body.documents).toEqual([]);
  });

  it('returns no documents for document_limit 0', async () => {
    const res = await post({ document_limit: 0 });
    expect(res.body.documents).toEqual([]);
    expect(res.body.ids).toHaveLength(23);
  });

  it('returns as many documents as ids when document_limit is larger', async () => {
    const res = await post({ id_limit: 4, document_limit: 100 });
    expect(res.body.documents).toHaveLength(4);
  });
});

describe('POST /search/index snapshot', () => {
  it('requires a snapshot when id_offset is above 0', async () => {
    const res = await post({ id_offset: 5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(expect.any(String));
  });

  it('answers 409 with indexed_at when the snapshot is stale', async () => {
    const res = await post({ id_offset: 5, snapshot: 999 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      message: expect.any(String),
      indexed_at: 1234,
    });
    expect((await post({ snapshot: 999 })).status).toBe(409);
  });

  it('accepts a matching snapshot', async () => {
    expect((await post({ snapshot: 1234 })).status).toBe(200);
  });
});

describe('POST /search/index search and ordering', () => {
  it('applies the same text search, filters and ordering as /search', async () => {
    const res = await post({
      kind: ['etf'],
      is_betashares: { value: false },
      units_circulating: { min: '1' },
      order_by: 'symbol.desc',
      search_text: 'plain',
      include: ['count'],
    });
    expect(res.body.count).toBe(0);

    const ordered = await post({ order_by: 'symbol.desc', kind: ['etf'] });
    expect(ordered.body.ids[0]).toBe('T19:AU');
    expect(ordered.body.count).toBe(22);
  });

  it('accepts a full valid request and an X-Client-Id header', async () => {
    const res = await api
      .post('/search/index')
      .set('X-Client-Id', '123e4567-e89b-42d3-a456-426614174000')
      .send({
        search_text: 'T0',
        kind: ['etf'],
        issuer: ['acme'],
        is_betashares: { value: false },
        is_flagship_fund: { value: false },
        is_portfolio_excluded: { value: false },
        is_auto_invest_included: { value: false },
        units_circulating: { min: '1', max: '2' },
        order_by: 'units_circulating.asc',
        include: ['count', 'facets', 'ids', 'documents'],
        id_offset: 0,
        id_limit: 1000,
        document_limit: 100,
        snapshot: 1234,
      });
    expect(res.status).toBe(200);
  });

  it('breaks ties by symbol_openfigi here, while /search keeps data order', async () => {
    const index = await post({ search_text: 'DUP' });
    expect(index.body.ids).toEqual(['DUP:AU', 'DUP:US']);

    const legacy = await api.post('/search').send({ search_text: 'DUP' });
    expect(
      legacy.body.results.map((d: InstrumentDocument) => d.symbol_openfigi),
    ).toEqual(['DUP:US', 'DUP:AU']);
  });
});

describe('POST /search/index validation', () => {
  const long = 'a'.repeat(101);
  it.each([
    ['an array body', []],
    ['an unknown field', { foo: 1 }],
    ['from', { from: 1 }],
    ['size', { size: 5 }],
    ['symbol_openfigi', { symbol_openfigi: ['A:AU'] }],
    ['a numeric search_text', { search_text: 1 }],
    ['a search_text over 100 chars', { search_text: long }],
    ['a non-array kind', { kind: 'etf' }],
    ['a non-string kind item', { kind: [1] }],
    ['a kind over 100 items', { kind: Array(101).fill('etf') }],
    ['a long issuer value', { issuer: [long] }],
    ['a string boolean filter', { is_betashares: { value: 'true' } }],
    [
      'a boolean filter with extra keys',
      { is_betashares: { value: true, x: 1 } },
    ],
    ['an empty boolean filter', { is_flagship_fund: {} }],
    ['a non-object boolean filter', { is_portfolio_excluded: true }],
    ['a numeric range bound', { units_circulating: { min: 5 } }],
    ['a non-numeric range bound', { units_circulating: { max: 'abc' } }],
    ['a range filter with extra keys', { units_circulating: { foo: '1' } }],
    ['order_by without a direction', { order_by: 'symbol' }],
    ['order_by on an unknown field', { order_by: 'foo.asc' }],
    ['order_by with a bad direction', { order_by: 'symbol.up' }],
    ['order_by on a field outside the whitelist', { order_by: 'kind.asc' }],
    ['a non-array include', { include: 'ids' }],
    ['an unknown include', { include: ['bogus'] }],
    ['a negative id_offset', { id_offset: -1 }],
    ['a fractional id_offset', { id_offset: 1.5 }],
    ['a string id_offset', { id_offset: '1' }],
    ['an id_offset above the bound', { id_offset: 1_000_001, snapshot: 1234 }],
    ['id_limit 0', { id_limit: 0 }],
    ['id_limit 1001', { id_limit: 1001 }],
    ['a negative document_limit', { document_limit: -1 }],
    ['document_limit 101', { document_limit: 101 }],
    ['a fractional snapshot', { snapshot: 1.5 }],
    ['a negative snapshot', { snapshot: -1 }],
    ['an unsafe snapshot', { snapshot: 2 ** 60 }],
    ['a string snapshot', { snapshot: '1234' }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: expect.any(String) });
  });

  it('rejects window fields with bad values even when ids is excluded', async () => {
    expect((await post({ include: ['count'], id_limit: 0 })).status).toBe(400);
  });
});

describe('body limit', () => {
  const big = { search_text: 'a'.repeat(40_000) };

  it('rejects a body over 32KB with 413', async () => {
    expect((await post(big)).status).toBe(413);
    expect((await api.post('/search').send(big)).status).toBe(413);
  });
});

describe('GET /version', () => {
  it('returns indexed_at', async () => {
    const res = await api.get('/version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ indexed_at: 1234 });
  });
});

describe('real instruments', () => {
  const real = request(createApp().callback());

  it('counts every instrument and returns the default window', async () => {
    const res = await real.post('/search/index').send({});
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(834);
    expect(res.body.ids).toHaveLength(834);
    expect(res.body.next_id_offset).toBeNull();
    expect(res.body.documents).toHaveLength(15);
  });

  it('reports the same indexed_at as /search and /version', async () => {
    const [index, legacy, version] = await Promise.all([
      real.post('/search/index').send({ include: ['count'] }),
      real.post('/search').send({}),
      real.get('/version'),
    ]);
    expect(index.body.indexed_at).toBe(legacy.body.indexed_at);
    expect(version.body.indexed_at).toBe(legacy.body.indexed_at);
  });
});
