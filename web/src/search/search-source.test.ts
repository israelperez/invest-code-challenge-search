import { describe, expect, it, vi } from 'vitest';
import type { InstrumentDocument, InstrumentsBatchResponse, SearchIndexResponse } from '../api/types';
import { createSearchSource, SnapshotStaleError } from './search-source';

const state = { term: '', filters: {} };
const options = { documentLimit: 2, orphanSize: 0, idLimit: 3 };
const ids = ['A:AU', 'B:AU', 'C:AU', 'D:AU', 'E:AU'];
const doc = (id: string) => ({ symbol: id, symbol_openfigi: id }) as InstrumentDocument;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

// A fake client that ignores the abort signal, like a response already on the wire.
function fakeApi() {
  return {
    searchIndex: vi.fn(
      async (body: { id_offset?: number }): Promise<SearchIndexResponse> =>
        body.id_offset
          ? { indexed_at: 1, ids: ids.slice(3), next_id_offset: null }
          : { indexed_at: 1, count: 5, ids: ids.slice(0, 3), next_id_offset: 3, documents: ids.slice(0, 2).map(doc) },
    ),
    instrumentsBatch: vi.fn(
      async (body: { ids: string[] }): Promise<InstrumentsBatchResponse> => ({
        documents: body.ids.map(doc),
        missing: [],
        indexed_at: 1,
      }),
    ),
  };
}

describe('SearchSource after reset', () => {
  it('a first load resolving after reset writes nothing', async () => {
    const api = fakeApi();
    const report = vi.fn();
    const late = deferred<SearchIndexResponse>();
    api.searchIndex.mockReturnValueOnce(late.promise);
    const source = createSearchSource(api, { ...options, report });

    const loading = source.loadFirst(state).catch((e: unknown) => e);
    source.reset();
    late.resolve({ indexed_at: 1, count: 5, ids: ids.slice(0, 3), next_id_offset: 3, documents: [{ ...doc('A:AU'), display_name: 'stale' }] });
    expect(await loading).toBeInstanceOf(SnapshotStaleError);
    expect(report).toHaveBeenCalledWith('late_response_discarded', { level: 'warn', message: expect.stringContaining('after the search source was reset') });

    // Empty index and store: loadMore fetches the first window again, and the stale document is gone.
    const batch = await source.loadMore(state, 0);
    expect(api.searchIndex).toHaveBeenCalledTimes(2);
    expect(batch.documents[0]).not.toHaveProperty('display_name');
  });

  it('a batch resolving after reset writes nothing', async () => {
    const api = fakeApi();
    const source = createSearchSource(api, options);
    await source.loadFirst(state);
    const late = deferred<InstrumentsBatchResponse>();
    api.instrumentsBatch.mockReturnValueOnce(late.promise);

    const loading = source.loadMore(state, 1).catch((e: unknown) => e);
    source.reset();
    late.resolve({ documents: [doc('C:AU')], missing: [], indexed_at: 1 });
    expect(await loading).toBeInstanceOf(SnapshotStaleError);

    await source.loadFirst(state);
    api.instrumentsBatch.mockClear();
    await source.loadMore(state, 1);
    expect(api.instrumentsBatch.mock.calls[0][0].ids).toEqual(['C:AU']);
  });

  it('a next window resolving after reset writes nothing', async () => {
    const api = fakeApi();
    const source = createSearchSource(api, options);
    await source.loadFirst(state);
    const late = deferred<SearchIndexResponse>();
    api.searchIndex.mockReturnValueOnce(late.promise);

    const loading = source.loadMore(state, 3).catch((e: unknown) => e);
    source.reset();
    late.resolve({ indexed_at: 1, ids: ids.slice(3), next_id_offset: null });
    expect(await loading).toBeInstanceOf(SnapshotStaleError);
    expect(api.instrumentsBatch).not.toHaveBeenCalled();

    // The old window did not leak into a fresh index: the first window is fetched again.
    await source.loadFirst(state);
    api.searchIndex.mockClear();
    await source.loadMore(state, 3);
    expect(api.searchIndex.mock.calls[0][0]).toMatchObject({ id_offset: 3 });
  });

  it('an aborted signal stops a response that arrives anyway', async () => {
    const api = fakeApi();
    const source = createSearchSource(api, options);
    await source.loadFirst(state);
    const late = deferred<InstrumentsBatchResponse>();
    api.instrumentsBatch.mockReturnValueOnce(late.promise);
    const controller = new AbortController();

    const loading = source.loadMore(state, 2, controller.signal).catch((e: unknown) => e);
    controller.abort();
    late.resolve({ documents: [doc('C:AU'), doc('D:AU')], missing: [], indexed_at: 1 });

    expect(controller.signal.aborted).toBe(true);
    expect(await loading).toBe(controller.signal.reason);
    api.instrumentsBatch.mockClear();
    await source.loadMore(state, 2);
    expect(api.instrumentsBatch.mock.calls[0][0].ids).toEqual(['C:AU', 'D:AU']);
  });
});

describe('SearchSource incomplete batch', () => {
  it('throws when a requested ID is neither returned nor reported missing, leaving the store untouched', async () => {
    const api = fakeApi();
    const report = vi.fn();
    const source = createSearchSource(api, { ...options, report });
    await source.loadFirst(state);
    api.instrumentsBatch.mockResolvedValueOnce({ documents: [doc('C:AU')], missing: [], indexed_at: 1 });

    await expect(source.loadMore(state, 2)).rejects.toThrow(/D:AU/);
    expect(report).toHaveBeenCalledWith('batch_incomplete', { level: 'error', message: expect.any(String), detail: ['D:AU'], entries: ['D:AU'] });

    api.instrumentsBatch.mockClear();
    const retry = await source.loadMore(state, 2);
    expect(api.instrumentsBatch.mock.calls[0][0].ids).toEqual(['C:AU', 'D:AU']);
    expect(retry.consumed).toBe(4);
  });
});

describe('SearchSource missing IDs', () => {
  it('reports the IDs the batch says are missing and skips them', async () => {
    const api = fakeApi();
    const report = vi.fn();
    const source = createSearchSource(api, { ...options, report });
    await source.loadFirst(state);
    api.instrumentsBatch.mockResolvedValueOnce({ documents: [doc('C:AU')], missing: ['D:AU'], indexed_at: 1 });

    const batch = await source.loadMore(state, 2);

    expect(batch.documents.map((d) => d.symbol_openfigi)).toEqual(['C:AU']);
    expect(report).toHaveBeenCalledWith('batch_ids_missing', { level: 'warn', message: expect.any(String), detail: ['D:AU'], entries: ['D:AU'] });
  });
});
