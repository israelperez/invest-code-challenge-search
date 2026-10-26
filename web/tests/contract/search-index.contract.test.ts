import { describe, expect, inject, it } from 'vitest';
import { createApiClient } from '../../src/api/client';
import { buildSearchRequest } from '../../src/search/build-search-request';
import { config } from '../../src/config';

const api = createApiClient(inject('apiBaseUrl'));

describe('real API contract', () => {
  it('answers the empty search with the full count and the first batch of documents', async () => {
    const request = { ...buildSearchRequest({ term: '', filters: {} }), document_limit: config.documentLimit };
    const response = await api.searchIndex(request);

    expect(response.count).toBe(834);
    expect(response.documents).toHaveLength(15);
    expect(response.ids).toHaveLength(Math.min(config.idLimit, 834));
    expect(typeof response.indexed_at).toBe('number');
  });

  it('reports indexed_at from /version', async () => {
    const { indexed_at } = await api.version();
    expect(typeof indexed_at).toBe('number');
  });
});
