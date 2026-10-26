import { ApiError, type ApiClient } from '../api/client';
import type { InstrumentDocument, SearchIndexResponse } from '../api/types';
import { buildSearchRequest, type SearchState } from './build-search-request';
import { planHydration } from './hydration-planner';
import { consoleReport, type Report } from './report';

// The API says the snapshot no longer matches: it restarted on new data. indexed_at is the new value.
export class SnapshotStaleError extends Error {
  constructor(readonly indexed_at: number | undefined) {
    super('The search snapshot is stale');
  }
}

type IndexEntry = { indexed_at: number; count: number; ids: string[]; next_id_offset: number | null };

export type SearchSource = ReturnType<typeof createSearchSource>;

// Owns what has been fetched: the document store and, per search state, the ID windows loaded so far.
export function createSearchSource(
  api: Pick<ApiClient, 'searchIndex' | 'instrumentsBatch'>,
  { documentLimit, orphanSize, idLimit, report = consoleReport }: { documentLimit: number; orphanSize: number; idLimit: number; report?: Report },
) {
  const store = new Map<string, InstrumentDocument>();
  const index = new Map<string, IndexEntry>();
  // Bumped by reset(); a request started before it must not write its late response.
  let generation = 0;

  // Called after every await, before writing. An aborted signal rethrows its abort reason. A reset
  // without an abort throws SnapshotStaleError, which the UI answers by reloading the first batch.
  function assertCurrent(startedIn: number, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (startedIn !== generation) {
      report('late_response_discarded', { level: 'warn', message: 'Discarded a response that arrived after the search source was reset' });
      throw new SnapshotStaleError(undefined);
    }
  }

  async function call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        throw new SnapshotStaleError((error.body as { indexed_at?: number } | undefined)?.indexed_at);
      }
      throw error;
    }
  }

  // Returns the first batch inlined, and remembers the first ID window for later batches.
  async function loadFirst(state: SearchState, signal?: AbortSignal): Promise<SearchIndexResponse> {
    const startedIn = generation;
    const request = buildSearchRequest(state);
    const response = await call(() =>
      api.searchIndex(
        { ...request, include: ['count', 'ids', 'documents'], document_limit: documentLimit + orphanSize, id_limit: idLimit },
        signal,
      ),
    );
    assertCurrent(startedIn, signal);
    index.set(JSON.stringify(request), {
      indexed_at: response.indexed_at,
      count: response.count ?? 0,
      ids: response.ids ?? [],
      next_id_offset: response.next_id_offset ?? null,
    });
    // The extra orphanSize documents are stored but shown only when they finish the results.
    const documents = response.documents ?? [];
    for (const document of documents) store.set(document.symbol_openfigi, document);
    const showAll = (response.count ?? 0) <= documentLimit + orphanSize;
    return { ...response, documents: showAll ? documents : documents.slice(0, documentLimit) };
  }

  // Loads the batch after the first `consumed` IDs. Resolves only once every document has arrived;
  // IDs the API reports missing are skipped. Returns the new total of consumed IDs.
  async function loadMore(state: SearchState, consumed: number, signal?: AbortSignal) {
    const startedIn = generation;
    const request = buildSearchRequest(state);
    const key = JSON.stringify(request);
    if (!index.has(key)) await loadFirst(state, signal);
    assertCurrent(startedIn, signal);
    const entry = index.get(key)!;
    const plan = () =>
      planHydration({
        ids: entry.ids,
        consumed,
        batchSize: documentLimit,
        orphanSize,
        count: entry.count,
        nextIdOffset: entry.next_id_offset,
        has: (id) => store.has(id),
      });

    let { batchIds, missingIds, needsNextWindow } = plan();
    while (needsNextWindow) {
      const window = await call(() =>
        api.searchIndex(
          { ...request, include: ['ids'], id_offset: entry.next_id_offset!, id_limit: idLimit, snapshot: entry.indexed_at },
          signal,
        ),
      );
      assertCurrent(startedIn, signal);
      entry.ids = [...entry.ids, ...(window.ids ?? [])];
      entry.next_id_offset = window.next_id_offset ?? null;
      ({ batchIds, missingIds, needsNextWindow } = plan());
    }

    if (missingIds.length > 0) {
      const batch = await call(() => api.instrumentsBatch({ ids: missingIds, snapshot: entry.indexed_at }, signal));
      assertCurrent(startedIn, signal);
      const reported = new Set([...batch.documents.map((d) => d.symbol_openfigi), ...batch.missing].map((id) => id.toUpperCase()));
      const unreported = missingIds.filter((id) => !reported.has(id.toUpperCase()));
      if (unreported.length > 0) {
        report('batch_incomplete', { level: 'error', message: 'Batch response omitted requested IDs', detail: unreported });
        throw new Error(`Batch response omitted requested IDs: ${unreported.join(', ')}`);
      }
      for (const document of batch.documents) store.set(document.symbol_openfigi, document);
      if (batch.missing.length > 0) report('batch_ids_missing', { level: 'warn', message: 'Instruments missing from the batch response, skipped:', detail: batch.missing });
    }

    return {
      documents: batchIds.filter((id) => store.has(id)).map((id) => store.get(id)!),
      consumed: consumed + batchIds.length,
    };
  }

  function reset() {
    generation++;
    store.clear();
    index.clear();
  }

  return { loadFirst, loadMore, reset };
}
