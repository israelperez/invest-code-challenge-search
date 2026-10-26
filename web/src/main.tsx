import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createApiClient } from './api/client';
import { config } from './config';
import { createClientId } from './search/client-id';
import { createSearchLogger } from './search/search-logger';
import { createSearchSource } from './search/search-source';
import { createSuggestionSource } from './search/suggestion-source';
import { SearchBackendContext } from './search/search-source-context';
import { system } from './theme';

const queryClient = new QueryClient();
const api = createApiClient(config.apiBaseUrl);
const backend = {
  api, source: createSearchSource(api, config),
  suggestions: createSuggestionSource(api, { termLimit: config.suggestionTermLimit }),
  logSearch: createSearchLogger(api, createClientId()),
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
