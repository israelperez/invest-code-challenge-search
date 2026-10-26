import { describe, expect, inject, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../../src/api/client';
import { createSearchSource, SnapshotStaleError } from '../../src/search/search-source';

const baseUrl = inject('apiBaseUrl');
const state = { term: '', filters: {} };
const options = { documentLimit: 15, idLimit: 20 };

// Wraps the real client so calls can be counted and, when asked, sent with a stale snapshot.
function spiedClient(staleSnapshot = false) {
  const real = createApiClient(baseUrl);
  const staleBy = staleSnapshot ? 1 : 0;
  return {
    searchIndex: vi.fn((body: Parameters<typeof real.searchIndex>[0], signal?: AbortSignal) =>
      real.searchIndex(body.snapshot === undefined ? body : { ...body, snapshot: body.snapshot + staleBy }, signal),
    ),
    instrumentsBatch: vi.fn((body: Parameters<typeof real.instrumentsBatch>[0], signal?: AbortSignal) =>
      real.instrumentsBatch({ ...body, snapshot: body.snapshot + staleBy }, signal),
    ),
    version: real.version,
  };
}

describe('real API client batch call', () => {
  it('returns documents and missing in request order, canonicalising IDs', async () => {
    const api = createApiClient(baseUrl);
    const { ids } = await api.searchIndex({ include: ['ids'], id_limit: 2 });
    const { indexed_at } = await api.version();
    const response = await api.instrumentsBatch({ ids: [ids![1].toLowerCase(), 'NOPE:AU', ids![0]], snapshot: indexed_at });

    expect(response.documents.map((d) => d.symbol_openfigi)).toEqual([ids![1], ids![0]]);
    expect(response.missing).toEqual(['NOPE:AU']);
    expect(response.indexed_at).toBe(indexed_at);
  });

  it('rejects a stale snapshot with a 409 carrying indexed_at', async () => {
    const api = createApiClient(baseUrl);
    const { indexed_at } = await api.version();
    const error = await api.instrumentsBatch({ ids: ['A200:AU'], snapshot: indexed_at + 1 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).body).toMatchObject({ indexed_at });
  });
});

describe('SearchSource load more against the real API', () => {
  it('walks every result once, fetching later ID windows on demand', async () => {
    const api = spiedClient();
    const source = createSearchSource(api, options);
    const first = await source.loadFirst(state);
    expect(first.documents).toHaveLength(15);

    const seen = first.documents!.map((d) => d.symbol_openfigi);
    let consumed = seen.length;
    while (consumed < first.count!) {
      const batch = await source.loadMore(state, consumed);
      expect(batch.documents.length).toBeGreaterThan(0);
      seen.push(...batch.documents.map((d) => d.symbol_openfigi));
      consumed = batch.consumed;
    }

    expect(consumed).toBe(834);
    expect(new Set(seen).size).toBe(834);
    expect(seen).toEqual((await createApiClient(baseUrl).searchIndex({ include: ['ids'], id_limit: 1000 })).ids);

    // Window 2 and onwards carry the snapshot and the offset where the previous window ended.
    const windowCalls = api.searchIndex.mock.calls.map(([body]) => body).filter((body) => body.id_offset);
    expect(windowCalls[0]).toMatchObject({ id_offset: 20, id_limit: 20, include: ['ids'], snapshot: first.indexed_at });
    expect(windowCalls).toHaveLength(Math.ceil(834 / 20) - 1);
  });

  it('requests only missing IDs when a state is loaded again', async () => {
    const api = spiedClient();
    const source = createSearchSource(api, options);
    await source.loadFirst(state);

    const once = await source.loadMore(state, 15);
    expect(api.instrumentsBatch).toHaveBeenCalledTimes(1);
    expect(api.instrumentsBatch.mock.calls[0][0].ids).toEqual(once.documents.map((d) => d.symbol_openfigi));

    const again = await source.loadMore(state, 15);
    expect(api.instrumentsBatch).toHaveBeenCalledTimes(1);
    expect(again.documents).toEqual(once.documents);

    // A different state sharing instruments with the store asks only for the ones it lacks.
    const reordered = { ...state, order_by: 'symbol.desc' as const };
    await source.loadFirst(reordered);
    api.instrumentsBatch.mockClear();
    const second = await source.loadMore(reordered, 15);
    const asked = api.instrumentsBatch.mock.calls.flatMap(([body]) => body.ids);
    const stored = new Set([...once.documents, ...(await source.loadFirst(state)).documents!].map((d) => d.symbol_openfigi));
    expect(asked).toEqual(second.documents.map((d) => d.symbol_openfigi).filter((id) => !stored.has(id)));
  });

  it('forgets everything on reset', async () => {
    const api = spiedClient();
    const source = createSearchSource(api, options);
    await source.loadFirst(state);
    await source.loadMore(state, 15);
    source.reset();
    api.instrumentsBatch.mockClear();

    await source.loadMore(state, 15);
    expect(api.instrumentsBatch).toHaveBeenCalledTimes(1);
  });

  it('throws SnapshotStaleError carrying the current indexed_at on a stale batch snapshot', async () => {
    const source = createSearchSource(spiedClient(true), options);
    const first = await source.loadFirst(state);

    const error = await source.loadMore(state, 15).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SnapshotStaleError);
    expect((error as SnapshotStaleError).indexed_at).toBe(first.indexed_at);
  });

  it('throws SnapshotStaleError on a stale next-window snapshot', async () => {
    const source = createSearchSource(spiedClient(true), options);
    const first = await source.loadFirst(state);

    // IDs 0-19 are loaded; consuming up to 20 forces the next window.
    const error = await source.loadMore(state, 20).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SnapshotStaleError);
    expect((error as SnapshotStaleError).indexed_at).toBe(first.indexed_at);
  });
});
