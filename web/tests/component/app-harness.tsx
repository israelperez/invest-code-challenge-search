import './jsdom-setup';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../../src/App';
import type { FacetEntry, InstrumentDocument, InstrumentsBatchRequest, SearchIndexRequest } from '../../src/api/types';
import { config } from '../../src/config';
import { createSearchSource } from '../../src/search/search-source';
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

// Every option of every facet key, each with the same count.
export const fakeFacets = (count: number): Record<string, FacetEntry[]> => ({
  kind: [{ value: 'equity', count }, { value: 'etf', count }],
  issuer: [{ value: 'acme', count }],
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
    version: vi.fn(async () => ({ indexed_at: fake.indexedAt })),
    searchIndex: vi.fn(async (body: SearchIndexRequest, _signal?: AbortSignal) => {
      const base = catalogues[body.search_text ?? 'a'];
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
    instrumentsBatch: vi.fn(async (body: InstrumentsBatchRequest, _signal?: AbortSignal) => ({
      documents: body.ids.map(doc),
      missing: [] as string[],
      indexed_at: fake.indexedAt,
    })),
  };
}
export type FakeApi = ReturnType<typeof fakeApi>;

export function renderApp(api: FakeApi) {
  const source = createSearchSource(api, { documentLimit: config.documentLimit, orphanSize: config.orphanSize, idLimit: config.idLimit });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        <SearchBackendContext.Provider value={{ api, source }}>
          <App />
        </SearchBackendContext.Provider>
      </QueryClientProvider>
    </ChakraProvider>,
  );
}

export async function search(term: string) {
  fireEvent.change(screen.getByLabelText('Search stocks and ETFs'), { target: { value: term } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByRole('heading', { level: 2 });
}

export const rows = () => Array.from(document.querySelectorAll('li:not([data-testid="skeleton-row"])'));
export const skeletonRows = () => screen.queryAllByTestId('skeleton-row');
