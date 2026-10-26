import { describe, expect, inject, it } from 'vitest';
import { createApiClient } from '../../src/api/client';
import { createSuggestionSource } from '../../src/search/suggestion-source';

const api = createApiClient(inject('apiBaseUrl'));

describe('real API suggestion calls', () => {
  it('facetIssuer returns issuer values with counts', async () => {
    const issuers = await api.facetIssuer();

    expect(issuers.length).toBeGreaterThan(0);
    expect(issuers[0]).toEqual({ value: expect.any(String), count: expect.any(Number) });
  });

  it('suggestInstruments returns at most size picked fields and indexed_at', async () => {
    const response = await api.suggestInstruments({ search_text: 'glo', size: 5 });

    expect(response.indexed_at).toEqual(expect.any(Number));
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.length).toBeLessThanOrEqual(5);
    expect(Object.keys(response.results[0]).sort()).toEqual(['display_name', 'logo', 'symbol', 'symbol_openfigi']);
  });

  it('the source finds an issuer term and instruments for "glo"', async () => {
    const { terms, instruments } = await createSuggestionSource(api, { termLimit: 5 }).suggest('glo', new AbortController().signal);

    expect(terms).toContain('Global X');
    expect(instruments.length).toBeGreaterThan(0);
  });
});
