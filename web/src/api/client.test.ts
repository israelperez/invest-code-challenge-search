import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const opts = { retries: 3, retryBaseMs: 1, timeoutMs: 1000 };

function setup(...responses: (Response | Error | 'hang')[]) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const next = responses.shift() ?? json(200, {});
    if (next === 'hang') {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
    }
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fetchMock);
  const report = vi.fn();
  return { fetchMock, report, api: createApiClient('http://x', { report, ...opts }) };
}

afterEach(() => vi.unstubAllGlobals());

describe('request gateway', () => {
  it('retries a 5xx up to 4 attempts, then reports once', async () => {
    const { api, fetchMock, report } = setup(json(503), json(503), json(503), json(503), json(200));
    await expect(api.version()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('api_call_failed', expect.objectContaining({ level: 'error', entries: ['version: GET /version failed with 503'] }));
  });

  it.each([
    ['searchIndex', (api: ReturnType<typeof setup>['api']) => api.searchIndex({}), 'search-index'],
    ['instrumentsBatch', (api: ReturnType<typeof setup>['api']) => api.instrumentsBatch({ ids: ['A:AU'], snapshot: 1 }), 'instruments-batch'],
  ])('reports a final %s failure once as major_failure', async (_name, call, caller) => {
    const { api, report } = setup(json(503), json(503), json(503), json(503));
    await expect(call(api)).rejects.toMatchObject({ status: 503 });
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('major_failure', expect.objectContaining({ level: 'error', message: expect.stringMatching(/^Major failure/), entries: [expect.stringMatching(new RegExp(`^${caller}: `))] }));
  });

  it('keeps api_call_failed for a minor caller, facet-issuer included', async () => {
    const { api, report } = setup(json(400), json(400));
    await expect(api.facetIssuer()).rejects.toBeDefined();
    await expect(api.popular(5)).rejects.toBeDefined();
    expect(report.mock.calls.map(([event]) => event)).toEqual(['api_call_failed', 'api_call_failed']);
  });

  it('does not report a major caller\'s 409 or abort', async () => {
    const { api, report } = setup(json(409, { indexed_at: 2 }), 'hang');
    await expect(api.searchIndex({})).rejects.toMatchObject({ status: 409 });
    const controller = new AbortController();
    const call = api.instrumentsBatch({ ids: [], snapshot: 1 }, controller.signal);
    controller.abort();
    await expect(call).rejects.toBeDefined();
    expect(report).not.toHaveBeenCalled();
  });

  it('retries a network error and does not report on success', async () => {
    const { api, fetchMock, report } = setup(new TypeError('Failed to fetch'), json(200, { indexed_at: 1 }));
    await expect(api.version()).resolves.toEqual({ indexed_at: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });

  it('does not retry a 4xx and reports it once', async () => {
    const { api, fetchMock, report } = setup(json(400));
    await expect(api.version()).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('does not retry or report a 409', async () => {
    const { api, fetchMock, report } = setup(json(409, { indexed_at: 2 }));
    await expect(api.version()).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('does not retry or report a caller abort', async () => {
    const { api, fetchMock, report } = setup('hang');
    const controller = new AbortController();
    const call = api.version(controller.signal);
    controller.abort();
    await expect(call).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('stops at once when the caller aborts during backoff', async () => {
    const { fetchMock, report } = setup(json(503));
    const api = createApiClient('http://x', { report, ...opts, retryBaseMs: 10_000 });
    const controller = new AbortController();
    const call = api.version(controller.signal);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(call).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('treats a timeout as a retryable failure', async () => {
    const { fetchMock, report } = setup('hang', json(200, { indexed_at: 1 }));
    const api = createApiClient('http://x', { report, ...opts, timeoutMs: 20 });
    await expect(api.version()).resolves.toEqual({ indexed_at: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });
});
