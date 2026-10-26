import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { createSearchLogger } from './search-logger';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function setup(logSearch = vi.fn(async (_term: string, _submissionId: string, _clientId: string) => undefined)) {
  const report = vi.fn();
  const log = createSearchLogger({ logSearch }, () => CLIENT_ID, report);
  return { logSearch, report, log };
}
// Lets the fire-and-forget request and its retry settle.
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

  it.each([
    ['a network error', () => new TypeError('Failed to fetch')],
    ['a 5xx', () => new ApiError(503, 'down')],
  ])('retries once with the same submission ID after %s', async (_name, makeError) => {
    const logSearch = vi.fn(async (_t: string, _s: string, _c: string) => undefined).mockRejectedValueOnce(makeError());
    const { log, report } = setup(logSearch);

    log('gold');
    await settle();

    expect(logSearch).toHaveBeenCalledTimes(2);
    expect(logSearch.mock.calls[1][1]).toBe(logSearch.mock.calls[0][1]);
    expect(report).not.toHaveBeenCalled();
  });

  it('gives up after one retry and reports to the console only', async () => {
    const logSearch = vi.fn(async (_t: string, _s: string, _c: string) => { throw new TypeError('Failed to fetch'); });
    const { log, report } = setup(logSearch);

    log('gold');
    await settle();

    expect(logSearch).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 4xx', async () => {
    const logSearch = vi.fn(async (_t: string, _s: string, _c: string) => { throw new ApiError(400, 'bad'); });
    const { log, report } = setup(logSearch);

    log('gold');
    await settle();

    expect(logSearch).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('reports to console.error by default', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSearch = vi.fn(async (_t: string, _s: string, _c: string) => { throw new ApiError(400, 'bad'); });

    createSearchLogger({ logSearch }, () => CLIENT_ID)('gold');
    await settle();

    expect(error).toHaveBeenCalledTimes(1);
  });
});
