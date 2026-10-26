import { describe, expect, it } from 'vitest';
import { buildSearchRequest } from './build-search-request';

describe('buildSearchRequest', () => {
  it('trims the term', () => {
    expect(buildSearchRequest({ term: '  a200  ', filters: {} })).toEqual({ search_text: 'a200' });
  });

  it('omits a blank term and empty filters', () => {
    const request = buildSearchRequest({
      term: '   ',
      filters: { kind: [], issuer: undefined, units_circulating: {} },
    });
    expect(request).toEqual({});
  });

  it('sorts filter values and filter keys', () => {
    const request = buildSearchRequest({
      term: 'x',
      filters: { issuer: ['vanguard', 'betashares'], kind: ['etf', 'equity'] },
    });
    expect(request.issuer).toEqual(['betashares', 'vanguard']);
    expect(request.kind).toEqual(['equity', 'etf']);
    expect(Object.keys(request)).toEqual(['issuer', 'kind', 'search_text']);
  });

  it('produces identical output whatever the input order', () => {
    const a = buildSearchRequest({ term: 'x', filters: { kind: ['etf', 'equity'], issuer: ['b', 'a'] } });
    const b = buildSearchRequest({ term: ' x', filters: { issuer: ['a', 'b'], kind: ['equity', 'etf'] } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('wraps booleans and keeps false, a real filter value', () => {
    const request = buildSearchRequest({
      term: '',
      filters: { is_betashares: false, is_flagship_fund: true },
    });
    expect(request).toEqual({ is_betashares: { value: false }, is_flagship_fund: { value: true } });
  });

  it('keeps only the units bounds that are set', () => {
    expect(buildSearchRequest({ term: '', filters: { units_circulating: { min: '10', max: '' } } })).toEqual({
      units_circulating: { min: '10' },
    });
  });

  it('includes order_by when set', () => {
    expect(buildSearchRequest({ term: '', filters: {}, order_by: 'symbol.asc' })).toEqual({ order_by: 'symbol.asc' });
  });
});
