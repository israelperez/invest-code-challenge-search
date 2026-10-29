import { ChakraProvider } from '@chakra-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createAnalytics } from './analytics/analytics';
import { createApiClient } from './api/client';
import { createQueryClient } from './api/query-client';
import { countProblems, createProblemCounter } from './insights/problem-counter';
import { config, popularRequestLimit } from './config';
import { applySettings } from './settings/settings';
import { createClientId } from './search/client-id';
import { createPopularSource } from './search/popular-source';
import { createRecentSearchStore } from './search/recent-search-store';
import { createSearchLogger } from './search/search-logger';
import { createSearchSource } from './search/search-source';
import { createSuggestionSource } from './search/suggestion-source';
import { SearchBackendContext } from './search/search-source-context';
import { system } from './theme';

// Demo settings override config before anything below reads it.
applySettings();

const queryClient = createQueryClient();
// Always on: events and problems go to analytics (the console stands in for an error-handling service).
const analytics = createAnalytics();
const problems = createProblemCounter();
const report = countProblems(problems, analytics.report);
const api = createApiClient(config.apiBaseUrl, { report });
const backend = {
  api, source: createSearchSource(api, { ...config, report }),
  suggestions: createSuggestionSource(api, { termLimit: config.suggestionTermLimit }),
  popular: createPopularSource(api, { limit: popularRequestLimit() }),
  recent: config.recentSearches ? createRecentSearchStore(undefined, { limit: config.recentSearchLimit }) : null,
  logSearch: createSearchLogger(api, createClientId()),
  analytics, report, problems,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        <SearchBackendContext.Provider value={backend}>
          <App />
        </SearchBackendContext.Provider>
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>,
);
