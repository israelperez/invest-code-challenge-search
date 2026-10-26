import { createContext, useContext } from 'react';
import type { ApiClient } from '../api/client';
import type { SearchSource } from './search-source';
import type { SuggestionSource } from './suggestion-source';

type SearchBackend = {
  api: ApiClient;
  source: SearchSource;
  suggestions: SuggestionSource;
  // Logs an explicit search to the server; never blocks the results.
  logSearch: (term: string) => void;
};

// Created once in main.tsx; tests provide their own over a fake client.
export const SearchBackendContext = createContext<SearchBackend | null>(null);

export function useSearchBackend(): SearchBackend {
  const backend = useContext(SearchBackendContext);
  if (!backend) throw new Error('SearchBackendContext.Provider is missing');
  return backend;
}
