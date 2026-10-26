import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createAnalytics } from './analytics/analytics';
import { createApiClient } from './api/client';
import { config, popularRequestLimit } from './config';
import { createClientId } from './search/client-id';
import { createPopularSource } from './search/popular-source';
import { createRecentSearchStore } from './search/recent-search-store';
import { consoleReport } from './search/report';
import { createSearchLogger } from './search/search-logger';
import { createSearchSource } from './search/search-source';
import { createSuggestionSource } from './search/suggestion-source';
import { SearchBackendContext } from './search/search-source-context';
import { system } from './theme';

const queryClient = new QueryClient();
const api = createApiClient(config.apiBaseUrl);
const analytics = createAnalytics({ enabled: config.analytics });
// Flag off: problems print as plain console output, as before analytics existed.
const report = config.analytics ? analytics.report : consoleReport;
const backend = {
  api, source: createSearchSource(api, { ...config, report }),
  suggestions: createSuggestionSource(api, { termLimit: config.suggestionTermLimit }),
  popular: createPopularSource(api, { limit: popularRequestLimit }),
  recent: config.recentSearches ? createRecentSearchStore(undefined, { limit: config.recentSearchLimit }) : null,
  logSearch: createSearchLogger(api, createClientId()),
  analytics, report,
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
