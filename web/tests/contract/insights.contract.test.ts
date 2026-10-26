import { describe, expect, inject, it } from 'vitest';
import { createApiClient } from '../../src/api/client';

const api = createApiClient(inject('apiBaseUrl'));

describe('real API zero-result insights contract', () => {
  it('returns groups in the documented shape', async () => {
    const { groups, includes_seed_data } = await api.zeroResults();

    expect(includes_seed_data).toBe(true);
    for (const group of groups) {
      expect(group).toEqual({
        key: expect.any(String),
        clients: expect.any(Number),
        total: expect.any(Number),
        spellings: expect.arrayContaining([{ text: expect.any(String), total: expect.any(Number) }]),
      });
      expect(group.clients).toBeGreaterThanOrEqual(2);
    }
  });
});
