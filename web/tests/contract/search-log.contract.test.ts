import { describe, expect, inject, it } from 'vitest';
import { createApiClient } from '../../src/api/client';

const baseUrl = inject('apiBaseUrl');
const api = createApiClient(baseUrl);

describe('real API search log contract', () => {
  it('accepts the client request with 202 and no body', async () => {
    await expect(api.logSearch('gold', crypto.randomUUID(), crypto.randomUUID())).resolves.toBeUndefined();
  });

  it('rejects a request without a client ID with 400', async () => {
    const response = await fetch(`${baseUrl}/searches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: 'gold', submission_id: crypto.randomUUID() }),
    });
    expect(response.status).toBe(400);
  });
});
