import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSearchLogger } from './search-logger';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function setup(logSearch = vi.fn(async (_term: string, _submissionId: string, _clientId: string) => undefined)) {
  const log = createSearchLogger({ logSearch }, () => CLIENT_ID);
  return { logSearch, log };
}
// Lets the fire-and-forget request settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.restoreAllMocks());

describe('search logger', () => {
  it('sends the term and client ID with a fresh submission ID each call', async () => {
    const { logSearch, log } = setup();

    log('gold');
    log('gold');
    await settle();

    const [[term, first, clientId], [, second]] = logSearch.mock.calls;
    expect(term).toBe('gold');
    expect(clientId).toBe(CLIENT_ID);
    expect(first).toMatch(UUID);
    expect(second).toMatch(UUID);
    expect(second).not.toBe(first);
  });

  it.each([[''], ['   ']])('never sends the blank term %j', async (term) => {
    const { logSearch, log } = setup();
    log(term);
    await settle();
    expect(logSearch).not.toHaveBeenCalled();
  });

  it('swallows a failure so there is no unhandled rejection', async () => {
    const logSearch = vi.fn(async (_t: string, _s: string, _c: string) => { throw new TypeError('Failed to fetch'); });
    const { log } = setup(logSearch);

    log('gold');
    await settle();

    expect(logSearch).toHaveBeenCalledTimes(1);
  });
});
