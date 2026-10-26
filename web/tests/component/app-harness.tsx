import './jsdom-setup';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../../src/App';
import type {
  FacetEntry,
  InstrumentDocument,
  InstrumentsBatchRequest,
  SearchIndexRequest,
  SuggestInstrumentsRequest,
} from '../../src/api/types';
import type { Analytics } from '../../src/analytics/analytics';
import { config, popularRequestLimit } from '../../src/config';
import { createPopularSource } from '../../src/search/popular-source';
import { createRecentSearchStore, type RecentSearchStore } from '../../src/search/recent-search-store';
import type { Report } from '../../src/search/report';
import { createSearchLogger } from '../../src/search/search-logger';
import { createSearchSource } from '../../src/search/search-source';
import { createSuggestionSource } from '../../src/search/suggestion-source';
import { SearchBackendContext } from '../../src/search/search-source-context';
import { system } from '../../src/theme';

// A fake API over catalogues named by the search text: "a" has 834 instruments, "b" 20, "c" 18 and "d" 19.
const catalogue = (prefix: string, length: number) =>
  Array.from({ length }, (_, i) => `${prefix}${String(i).padStart(4, '0')}:AU`);
export const catalogues: Record<string, string[]> = {
  a: catalogue('A', 834),
  b: catalogue('B', 20),
  c: catalogue('C', 18),
  d: catalogue('D', 19),
  none: [],
};
export const fake = { indexedAt: 1 };
export const doc = (id: string): InstrumentDocument => ({
  symbol: id.split(':')[0],
  symbol_openfigi: id,
  display_name: `Fund ${id} v${fake.indexedAt}`,
  kind: 'etf',
  currency: 'AUD',
  logo: null,
  issuer: 'acme',
  is_betashares: false,
  is_flagship_fund: false,
  is_portfolio_excluded: false,
  is_auto_invest_included: false,
  units_circulating: null,
});

// Eleven issuers, so Show all has something to reveal; the last two are look-alikes the API keeps apart.
const ISSUERS = ['acme', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'investors mutual', 'investors_mutual'];

// Every option of every facet key, each with the same count.
export const fakeFacets = (count: number): Record<string, FacetEntry[]> => ({
  kind: [{ value: 'equity', count }, { value: 'etf', count }],
  issuer: ISSUERS.map((value) => ({ value, count })),
  is_betashares: [{ value: 'true', count }, { value: 'false', count }],
  is_flagship_fund: [{ value: 'true', count }, { value: 'false', count }],
  is_auto_invest_included: [{ value: 'true', count }, { value: 'false', count }],
  is_portfolio_excluded: [{ value: 'true', count }, { value: 'false', count }],
  units_circulating: [
    '0,100000000',
    '100000000,500000000',
    '500000000,1000000000',
    '1000000000,5000000000',
    '5000000000,1000000000000',
  ].map((value) => ({ value, count })),
});

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

export function fakeApi() {
  return {
    popular: vi.fn(async (_limit: number, _signal?: AbortSignal) => ({
      terms: [
        { label: 'A200', key: 'a200', clients: 9 },
        { label: 'Vanguard', key: 'vanguard', clients: 7 },
      ],
      includes_seed_data: true as const,
    })),
    zeroResults: vi.fn(async (_signal?: AbortSignal) => ({
      groups: [
        { key: 'bitcoin', clients: 4, total: 9, spellings: [{ text: 'Bitcoin', total: 7 }, { text: 'BTC', total: 2 }] },
        { key: 'crypto', clients: 2, total: 3, spellings: [{ text: 'Crypto', total: 3 }] },
      ],
      includes_seed_data: true as const,
    })),
    clearSearchLog: vi.fn(async () => undefined),
    restoreSeed: vi.fn(async () => undefined),
    logSearch: vi.fn(async (_term: string, _submissionId: string, _clientId: string) => undefined),
    version: vi.fn(async () => ({ indexed_at: fake.indexedAt })),
    searchIndex: vi.fn(async (body: SearchIndexRequest, _signal?: AbortSignal) => {
      const base = catalogues[body.search_text ?? 'a'] ?? catalogues.b;
      // Reverse for .desc so a sort change is observable.
      const all = body.order_by?.endsWith('.desc') ? [...base].reverse() : base;
      const window = all.slice(body.id_offset ?? 0, (body.id_offset ?? 0) + (body.id_limit ?? 1000));
      const next = (body.id_offset ?? 0) + window.length;
      return {
        indexed_at: fake.indexedAt,
        count: all.length,
        ...(body.include?.includes('facets') && { facets: fakeFacets(all.length) }),
        ids: window,
        next_id_offset: next < all.length ? next : null,
        ...(body.include?.includes('documents') && { documents: window.slice(0, body.document_limit).map(doc) }),
      };
    }),
    // Issuer slugs as the API returns them; "globalx" is labelled "Global X".
    facetIssuer: vi.fn(async (_signal?: AbortSignal): Promise<FacetEntry[]> =>
      ['globalx', 'global_funds', 'vaneck', 'x_global'].map((value) => ({ value, count: 1 })),
    ),
    // "zzz" matches nothing; any other text finds the same two instruments.
    suggestInstruments: vi.fn(async (body: SuggestInstrumentsRequest, _signal?: AbortSignal) => ({
      results:
        body.search_text === 'zzz'
          ? []
          : [
              { symbol: 'GLOB', symbol_openfigi: 'GLOB:AU', display_name: 'Global Share Active ETF', logo: null },
              { symbol: 'ARMR', symbol_openfigi: 'ARMR:AU', display_name: 'Global Defence ETF', logo: null },
            ],
      count: 2,
      indexed_at: fake.indexedAt,
    })),
    instrumentsBatch: vi.fn(async (body: InstrumentsBatchRequest, _signal?: AbortSignal) => ({
      documents: body.ids.map(doc),
      missing: [] as string[],
      indexed_at: fake.indexedAt,
    })),
  };
}
export type FakeApi = ReturnType<typeof fakeApi>;

// The recent store sits over a fresh in-memory Storage per call; pass `recent: null` for the flag off, or a store to share one.
export function freshRecentStore(limit: number = config.recentSearchLimit) {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } as Storage;
  return createRecentSearchStore(() => storage, { limit });
}

// Returns the spies the backend was given: product events and problem reports. Pass your own to share them.
export function renderApp(
  api: FakeApi,
  { recent = freshRecentStore(), analytics = { track: vi.fn() }, report = vi.fn() }: { recent?: RecentSearchStore | null; analytics?: Analytics; report?: Report } = {},
) {
  const source = createSearchSource(api, { documentLimit: config.documentLimit, orphanSize: config.orphanSize, idLimit: config.idLimit, report });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        <SearchBackendContext.Provider value={{ api, source, suggestions: createSuggestionSource(api, { termLimit: config.suggestionTermLimit }), popular: createPopularSource(api, { limit: popularRequestLimit() }), recent, logSearch: createSearchLogger(api, () => 'test-client'), analytics, report }}>
          <App />
        </SearchBackendContext.Provider>
      </QueryClientProvider>
    </ChakraProvider>,
  );
  return { analytics, report };
}

export async function search(term: string) {
  fireEvent.change(screen.getByLabelText('Search shares and ETFs'), { target: { value: term } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByRole('heading', { level: 2 });
}

export const rows = () => Array.from(document.querySelectorAll('ul:not([aria-label="Applied filters"]) > li:not([data-testid="skeleton-row"])'));
export const skeletonRows = () => screen.queryAllByTestId('skeleton-row');
