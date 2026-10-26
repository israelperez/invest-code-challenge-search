import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createApiClient } from './api/client';
import { config } from './config';
import { createSearchSource } from './search/search-source';
import { SearchBackendContext } from './search/search-source-context';

const queryClient = new QueryClient();
const api = createApiClient(config.apiBaseUrl);
const backend = { api, source: createSearchSource(api, config) };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={queryClient}>
        <SearchBackendContext.Provider value={backend}>
          <App />
        </SearchBackendContext.Provider>
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>,
);
