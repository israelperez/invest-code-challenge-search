import type { ApiClient } from '../api/client';
import type { PopularTerm } from '../api/types';

// Popular searches are fetched once per page load and shared; a failure is forgotten so a retry is possible.
export function createPopularSource(api: Pick<ApiClient, 'popular'>, options: { limit: number }) {
  let terms: Promise<PopularTerm[]> | undefined;
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    // Forgets the shared result so the next terms() refetches (after the search log is reset), and tells whoever shows it.
    refresh() {
      terms = undefined;
      version++;
      listeners.forEach((listener) => listener());
    },
    version: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    terms() {
      terms ??= api.popular(options.limit).then(
        (response) => response.terms,
        (error) => {
          terms = undefined;
          throw error;
        },
      );
      return terms;
    },
  };
}
export type PopularSource = ReturnType<typeof createPopularSource>;
