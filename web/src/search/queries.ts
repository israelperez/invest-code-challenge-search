import { keepPreviousData, type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { SearchIndexRequest, SearchIndexResponse } from '../api/types';
import { config } from '../config';
import { buildSearchRequest, type Filters, type SearchState } from './build-search-request';
import type { SearchSource } from './search-source';
import { useSearchBackend } from './search-source-context';
import { useRetry } from './use-retry';

const VERSION_KEY = ['version'] as const;
const SEARCH_KEY = 'search-index';
const KNOWN_INDEXED_AT_KEY = ['known-indexed-at'] as const;

const searchKey = (indexedAt: number | null, request: ReturnType<typeof buildSearchRequest> | null) =>
  [SEARCH_KEY, indexedAt, request, config.documentLimit, config.orphanSize, config.idLimit] as const;

// A changed indexed_at means the API restarted: drop cached searches and re-check the version.
function observeIndexedAt(queryClient: QueryClient, source: SearchSource, indexedAt: number | undefined) {
  if (indexedAt === undefined) return;
  const known = queryClient.getQueryData<number>(KNOWN_INDEXED_AT_KEY);
  if (known === indexedAt) return;
  queryClient.setQueryData(KNOWN_INDEXED_AT_KEY, indexedAt);
  if (known === undefined) return;
  source.reset();
  void queryClient.resetQueries({ queryKey: [SEARCH_KEY] });
  void queryClient.invalidateQueries({ queryKey: VERSION_KEY });
}

export function useVersion() {
  const { api, source } = useSearchBackend();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: VERSION_KEY,
    queryFn: ({ signal }) => api.version(signal),
    staleTime: config.versionStaleTimeMs,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  useEffect(() => observeIndexedAt(queryClient, source, query.data?.indexed_at), [queryClient, source, query.data]);
  return query;
}

// `state` null = nothing submitted yet. Waits for the version so the key carries a settled indexed_at.
export function useSearchIndex(state: SearchState | null) {
  const { source } = useSearchBackend();
  const queryClient = useQueryClient();
  const version = useVersion();
  const request = state ? buildSearchRequest(state) : null;
  const query = useQuery({
    queryKey: searchKey(version.data?.indexed_at ?? null, request),
    queryFn: ({ signal }) => source.loadFirst(state!, signal),
    enabled: request !== null && !version.isPending,
    staleTime: config.searchStaleTimeMs,
    // Changing only the filters keeps the previous results on screen while they load; a new term or sort shows skeletons.
    placeholderData: (previous, previousQuery) => {
      const before = previousQuery?.queryKey[2];
      return before?.search_text === request?.search_text && before?.order_by === request?.order_by ? previous : undefined;
    },
  });
  useEffect(() => observeIndexedAt(queryClient, source, query.data?.indexed_at), [queryClient, source, query.data]);
  return query;
}

// After a 409: forget the session's fetches and reload the first batch without blanking the results.
// The new first batch is cached under the current and the post-restart key, so neither shows a skeleton.
export function useRestartSearch(state: SearchState) {
  const { source } = useSearchBackend();
  const queryClient = useQueryClient();
  const version = useVersion();
  const request = buildSearchRequest(state);
  return async (signal: AbortSignal) => {
    source.reset();
    const first: SearchIndexResponse = await source.loadFirst(state, signal);
    if (signal.aborted) return;
    // Known first, so observeIndexedAt sees nothing new and does not reset the cached searches.
    queryClient.setQueryData(KNOWN_INDEXED_AT_KEY, first.indexed_at);
    queryClient.setQueryData(searchKey(first.indexed_at, request), first);
    queryClient.setQueryData(searchKey(version.data?.indexed_at ?? null, request), first);
    void queryClient.invalidateQueries({ queryKey: VERSION_KEY });
  };
}

// Counts and facets for the pending filters. order_by is left out of the key, so a sort never refetches them.
export function useFacetCounts(term: string, pending: Filters) {
  const { api } = useSearchBackend();
  const version = useVersion();
  const key = JSON.stringify(buildSearchRequest({ term, filters: pending }));
  const request = useMemo(() => JSON.parse(key) as SearchIndexRequest, [key]);
  const query = useQuery({
    queryKey: ['facet-counts', version.data?.indexed_at ?? null, request],
    queryFn: ({ signal }) => api.searchIndex({ ...request, include: ['count', 'facets'] }, signal),
    enabled: !version.isPending,
    staleTime: config.searchStaleTimeMs,
    // Kept for the rail's structure (bucket edges) only; its numbers are never shown.
    placeholderData: keepPreviousData,
  });
  const loading = !query.isError && (query.isPending || query.isPlaceholderData);
  // Only counts for the current state are shown or used to disable options.
  const ready = !loading && !query.isError;
  const { retrying, retry } = useRetry(() => query.refetch(), key);
  return {
    facets: ready ? query.data?.facets : undefined,
    // Possibly from an earlier state: use for which rows exist, never for counts.
    known: query.data?.facets,
    count: ready ? query.data?.count : undefined,
    loading,
    error: query.isError || retrying,
    retrying,
    retry: () => void retry(),
  };
}
