import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { JsonInstrumentsRepository } from '../src/index';
import { RANGE_FACET_BUCKETS } from '../src/models/search-fields.config';
import { envConfig } from '../src/shared/configs/env.config';

// Characterises the legacy API against the real data/instruments.json.
const api = request(createApp().callback());
const search = (body: object = {}) => api.post('/search').send(body);

describe('legacy API on the real instruments', () => {
  it('reports the health of the API', async () => {
    const res = await api.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Successful health check of the Search Mock API.');
  });

  it('counts every instrument for an empty search and returns a first page of 15', async () => {
    const res = await search();
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(834);
    expect(res.body.results).toHaveLength(15);
  });

  it('reports indexed_at as the repository does, never a literal', async () => {
    const repository = new JsonInstrumentsRepository(envConfig.instrumentsFile);
    expect((await search()).body.indexed_at).toBe(
      await repository.getIndexedAt(),
    );
  });

  it('puts Betashares first, then orders by symbol', async () => {
    const { results } = (await search()).body;
    const symbols: string[] = results.map((r: { symbol: string }) => r.symbol);

    expect(
      results.every((r: { is_betashares: boolean }) => r.is_betashares),
    ).toBe(true);
    expect(symbols.slice(0, 4)).toEqual(['28BB', '29BB', '30BB', 'A200']);
    expect(symbols).toEqual([...symbols].sort());
  });

  it('combines filters', async () => {
    const res = await search({ kind: ['etf'], is_betashares: { value: true } });
    expect(res.body.count).toBe(102);
  });

  it('ranks an exact ticker first', async () => {
    const res = await search({ search_text: 'a200' });
    expect(res.body.results[0].symbol).toBe('A200');
  });

  it('serves one instrument, ignoring case', async () => {
    const res = await api.get('/instruments/a200:au');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      symbol: 'A200',
      symbol_openfigi: 'A200:AU',
      display_name: 'Betashares Australia 200 ETF',
      kind: 'etf',
      currency: 'AUD',
      logo: 'https://instruments.wealth.betashares.com.au/logos-etf/betashares.png',
      issuer: 'betashares',
      is_betashares: true,
      is_flagship_fund: true,
      is_portfolio_excluded: false,
      is_auto_invest_included: true,
      units_circulating: null,
    });
  });

  describe('facets', () => {
    const facet = async (key: string) =>
      (await api.post(`/facets/${key}`).send({})).body;

    it('counts kind', async () => {
      expect(await facet('kind')).toEqual([
        { value: 'equity', count: 378 },
        { value: 'etf', count: 456 },
      ]);
    });

    it.each([
      ['is_betashares', 102, 732],
      ['is_flagship_fund', 9, 825],
      ['is_portfolio_excluded', 7, 827],
      ['is_auto_invest_included', 95, 739],
    ])('counts %s', async (key, yes, no) => {
      expect(await facet(key)).toEqual([
        { value: 'true', count: yes },
        { value: 'false', count: no },
      ]);
    });

    it('counts units_circulating buckets', async () => {
      expect(await facet('units_circulating')).toEqual([
        { value: '0,100000000', count: 27 },
        { value: '100000000,500000000', count: 161 },
        { value: '500000000,1000000000', count: 76 },
        { value: '1000000000,5000000000', count: 104 },
        { value: '5000000000,1000000000000', count: 7 },
      ]);
    });

    it('counts issuer', async () => {
      const issuers = await facet('issuer');
      expect(issuers[0]).toEqual({ value: 'aberdeen', count: 1 });
      expect(issuers).toContainEqual({ value: 'alphinity', count: 2 });
    });

    it('lists the facet keys', async () => {
      const keys = [
        'kind',
        'issuer',
        'is_betashares',
        'is_flagship_fund',
        'is_portfolio_excluded',
        'is_auto_invest_included',
        'units_circulating',
      ];
      expect((await api.get('/facets/keys')).body).toEqual(keys);
      expect((await api.get('/v2/facets/keys')).body).toEqual({
        all: keys,
        etf: keys.slice(0, -1),
        equity: keys,
      });
    });
  });

  describe('errors', () => {
    it('answers unknown routes with 404 { error: 404 }', async () => {
      const res = await api.get('/nope');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 404 });
    });

    it('answers a wrong method with 405 as JSON', async () => {
      const res = await api.put('/search');
      expect(res.status).toBe(405);
      expect(res.body).toEqual({ message: 'Method Not Allowed' });
    });

    it('answers an invalid JSON body with 400', async () => {
      const res = await api
        .post('/search')
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(res.status).toBe(400);
      expect(typeof res.body.message).toBe('string');
    });
  });
});

describe('legacy data', () => {
  it('has no instrument exactly on a units_circulating bucket edge', async () => {
    const repository = new JsonInstrumentsRepository(envConfig.instrumentsFile);
    const edges = RANGE_FACET_BUCKETS.units_circulating;

    const onEdge = (await repository.getAll()).filter(
      ({ units_circulating }) =>
        units_circulating !== null &&
        edges.includes(parseFloat(units_circulating)),
    );

    expect(onEdge).toEqual([]);
  });
});
