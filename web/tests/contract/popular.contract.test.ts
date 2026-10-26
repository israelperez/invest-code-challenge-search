import { describe, expect, inject, it } from 'vitest';
import { createApiClient } from '../../src/api/client';

const api = createApiClient(inject('apiBaseUrl'));

describe('real API popular contract', () => {
  it('returns the seeded popular terms in the documented shape', async () => {
    const { terms, includes_seed_data } = await api.popular(15);

    expect(includes_seed_data).toBe(true);
    expect(terms).toHaveLength(15);
    for (const term of terms) {
      expect(term).toEqual({ label: expect.any(String), key: expect.any(String), clients: expect.any(Number) });
      expect(term.clients).toBeGreaterThanOrEqual(3);
    }
  });

  it('rejects a bad limit with 400', async () => {
    const response = await fetch(`${inject('apiBaseUrl')}/popular?limit=0`);
    expect(response.status).toBe(400);
  });
});
