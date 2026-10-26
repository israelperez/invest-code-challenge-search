import type { ApiClient } from '../api/client';
import type { PopularTerm } from '../api/types';

// Popular searches are fetched once per page load and shared; a failure is forgotten so a retry is possible.
export function createPopularSource(api: Pick<ApiClient, 'popular'>, options: { limit: number }) {
  let terms: Promise<PopularTerm[]> | undefined;
  return {
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
