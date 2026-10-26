import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { InstrumentDocument, InstrumentsRepository } from '../src/index';

// Tests POST /instruments/batch on a small in-memory catalogue.
const doc = (symbol: string): InstrumentDocument => ({
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
});

const documents = [doc('AAA'), doc('BBB'), doc('CCC')];
const repository: InstrumentsRepository = {
  getAll: () => Promise.resolve(documents),
  getIndexedAt: () => Promise.resolve(1234),
};
const api = request(createApp({ repository }).callback());
const post = (body: unknown) =>
  api.post('/instruments/batch').send(body as object);

describe('POST /instruments/batch', () => {
  it('returns documents and missing in request order with indexed_at', async () => {
    const res = await post({
      ids: ['CCC:AU', 'ZZZ:AU', 'AAA:AU', 'YYY:AU'],
      snapshot: 1234,
    });
    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([doc('CCC'), doc('AAA')]);
    expect(res.body.missing).toEqual(['ZZZ:AU', 'YYY:AU']);
    expect(res.body.indexed_at).toBe(1234);
  });

  it('canonicalises lowercase IDs to uppercase', async () => {
    const res = await post({ ids: ['bbb:au', 'zzz:au'], snapshot: 1234 });
    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([doc('BBB')]);
    expect(res.body.missing).toEqual(['ZZZ:AU']);
  });

  it('collapses duplicates, including case-only ones, keeping first occurrence order', async () => {
    const res = await post({
      ids: ['BBB:AU', 'AAA:AU', 'bbb:au', 'BBB:AU', 'zzz:au', 'ZZZ:AU'],
      snapshot: 1234,
    });
    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([doc('BBB'), doc('AAA')]);
    expect(res.body.missing).toEqual(['ZZZ:AU']);
  });

  it('accepts exactly 1 and 100 IDs', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => `X${i}:AU`);
    expect((await post({ ids: ['AAA:AU'], snapshot: 1234 })).status).toBe(200);
    const res = await post({ ids: hundred, snapshot: 1234 });
    expect(res.status).toBe(200);
    expect(res.body.missing).toHaveLength(100);
  });

  const invalid: [string, unknown][] = [
    ['no IDs', { ids: [], snapshot: 1234 }],
    [
      '101 IDs',
      {
        ids: Array.from({ length: 101 }, (_, i) => `X${i}:AU`),
        snapshot: 1234,
      },
    ],
    ['ids not an array', { ids: 'AAA:AU', snapshot: 1234 }],
    ['ids missing', { snapshot: 1234 }],
    ['an ID without a market', { ids: ['AAA'], snapshot: 1234 }],
    ['an ID with a bad market', { ids: ['AAA:AUS'], snapshot: 1234 }],
    ['an ID with a bad character', { ids: ['A-A:AU'], snapshot: 1234 }],
    ['a non-string ID', { ids: [42], snapshot: 1234 }],
    ['an over-long ID', { ids: [`${'A'.repeat(40)}:AU`], snapshot: 1234 }],
    ['an unknown field', { ids: ['AAA:AU'], snapshot: 1234, extra: true }],
    ['a missing snapshot', { ids: ['AAA:AU'] }],
    ['a string snapshot', { ids: ['AAA:AU'], snapshot: '1234' }],
    ['a negative snapshot', { ids: ['AAA:AU'], snapshot: -1 }],
    ['a fractional snapshot', { ids: ['AAA:AU'], snapshot: 1.5 }],
    ['a non-object body', ['AAA:AU']],
  ];
  it.each(invalid)('rejects %s with 400', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(typeof res.body.message).toBe('string');
  });

  it('returns 409 with the current indexed_at when the snapshot is stale', async () => {
    const res = await post({ ids: ['AAA:AU'], snapshot: 999 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      message: 'The snapshot is stale, restart from the first window',
      indexed_at: 1234,
    });
  });

  it('validates before checking the snapshot', async () => {
    expect((await post({ ids: [], snapshot: 999 })).status).toBe(400);
  });

  it('leaves GET /instruments/:id unchanged', async () => {
    const res = await api.get('/instruments/aaa:au');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(doc('AAA'));
    expect((await api.get('/instruments/nope:au')).status).toBe(404);
  });
});
