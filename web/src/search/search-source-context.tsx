import { createContext, useContext } from 'react';
import type { ApiClient } from '../api/client';
import type { SearchSource } from './search-source';

type SearchBackend = { api: ApiClient; source: SearchSource };

// Created once in main.tsx; tests provide their own over a fake client.
export const SearchBackendContext = createContext<SearchBackend | null>(null);

export function useSearchBackend(): SearchBackend {
  const backend = useContext(SearchBackendContext);
  if (!backend) throw new Error('SearchBackendContext.Provider is missing');
  return backend;
}
