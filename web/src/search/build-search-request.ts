import type { OrderBy, SearchIndexRequest } from '../api/types';

export type Filters = {
  kind?: string[];
  issuer?: string[];
  is_betashares?: boolean;
  is_flagship_fund?: boolean;
  is_portfolio_excluded?: boolean;
  is_auto_invest_included?: boolean;
  units_circulating?: { min?: string; max?: string };
};

export type SearchState = { term: string; filters: Filters; order_by?: OrderBy };

const BOOLEAN_FILTERS = ['is_betashares', 'is_flagship_fund', 'is_portfolio_excluded', 'is_auto_invest_included'] as const;

// The one canonical request for a search state: the same object is the request body and the query key.
// Keys are inserted in sorted order so JSON.stringify of equal states is identical.
export function buildSearchRequest(state: SearchState): SearchIndexRequest {
  const { filters } = state;
  const entries: [string, unknown][] = [];

  for (const key of ['kind', 'issuer'] as const) {
    const values = filters[key];
    if (values?.length) entries.push([key, [...values].sort()]);
  }
  for (const key of BOOLEAN_FILTERS) {
    if (filters[key] !== undefined) entries.push([key, { value: filters[key] }]);
  }
  const { min, max } = filters.units_circulating ?? {};
  if (min || max) entries.push(['units_circulating', { ...(min && { min }), ...(max && { max }) }]);

  if (state.order_by) entries.push(['order_by', state.order_by]);
  const term = state.term.trim();
  if (term) entries.push(['search_text', term]);

  return Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : 1)));
}
