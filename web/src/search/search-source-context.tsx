import { createContext, useContext } from 'react';
import type { ApiClient } from '../api/client';
import type { Analytics } from '../analytics/analytics';
import type { ProblemCounter } from '../insights/problem-counter';
import type { PopularSource } from './popular-source';
import type { Report } from './report';
import type { RecentSearchStore } from './recent-search-store';
import type { SearchSource } from './search-source';
import type { SuggestionSource } from './suggestion-source';

type SearchBackend = {
  api: ApiClient;
  source: SearchSource;
  suggestions: SuggestionSource;
  popular: PopularSource;
  // Null when the recentSearches flag is off.
  recent: RecentSearchStore | null;
  // Logs an explicit search to the server; never blocks the results.
  logSearch: (term: string) => void;
  // Product events; does nothing when the analytics flag is off.
  analytics: Analytics;
  // Where data and API problems go: analytics when its flag is on, else the console.
  report: Report;
  // Per-session problem counts, fed by every report call.
  problems: ProblemCounter;
};

// Created once in main.tsx; tests provide their own over a fake client.
export const SearchBackendContext = createContext<SearchBackend | null>(null);

export function useSearchBackend(): SearchBackend {
  const backend = useContext(SearchBackendContext);
  if (!backend) throw new Error('SearchBackendContext.Provider is missing');
  return backend;
}
