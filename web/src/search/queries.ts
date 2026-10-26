import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createApiClient } from '../api/client';
import { config } from '../config';
import { buildSearchRequest, type SearchState } from './build-search-request';

const api = createApiClient(config.apiBaseUrl);

const VERSION_KEY = ['version'] as const;
const SEARCH_KEY = 'search-index';
const KNOWN_INDEXED_AT_KEY = ['known-indexed-at'] as const;

// A changed indexed_at means the API restarted: drop cached searches and re-check the version.
function observeIndexedAt(queryClient: QueryClient, indexedAt: number | undefined) {
  if (indexedAt === undefined) return;
  const known = queryClient.getQueryData<number>(KNOWN_INDEXED_AT_KEY);
  if (known === indexedAt) return;
  queryClient.setQueryData(KNOWN_INDEXED_AT_KEY, indexedAt);
  if (known === undefined) return;
  void queryClient.resetQueries({ queryKey: [SEARCH_KEY] });
  void queryClient.invalidateQueries({ queryKey: VERSION_KEY });
}

export function useVersion() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: VERSION_KEY,
    queryFn: ({ signal }) => api.version(signal),
    staleTime: config.versionStaleTimeMs,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  useEffect(() => observeIndexedAt(queryClient, query.data?.indexed_at), [queryClient, query.data]);
  return query;
}

// `state` null = nothing submitted yet. Waits for the version so the key carries a settled indexed_at.
export function useSearchIndex(state: SearchState | null) {
  const queryClient = useQueryClient();
  const version = useVersion();
  const request = state ? buildSearchRequest(state) : null;
  const query = useQuery({
    queryKey: [SEARCH_KEY, version.data?.indexed_at ?? null, request, config.documentLimit, config.idLimit],
    queryFn: ({ signal }) =>
      api.searchIndex(
        { ...request, include: ['count', 'ids', 'documents'], document_limit: config.documentLimit, id_limit: config.idLimit },
        signal,
      ),
    enabled: request !== null && !version.isPending,
    staleTime: config.searchStaleTimeMs,
  });
  useEffect(() => observeIndexedAt(queryClient, query.data?.indexed_at), [queryClient, query.data]);
  return query;
}
