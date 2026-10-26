import { InstrumentDocument } from './instrument.model';
import { InstrumentSearchQuery } from './search-query.model';

export const INCLUDE_VALUES = ['count', 'facets', 'ids', 'documents'] as const;
export type IncludeValue = (typeof INCLUDE_VALUES)[number];

export const ORDER_BY_FIELDS = [
  'symbol',
  'display_name',
  'units_circulating',
] as const;

export const DEFAULT_ID_LIMIT = 1000;
export const MAX_ID_LIMIT = 1000;
export const DEFAULT_DOCUMENT_LIMIT = 15;
export const MAX_DOCUMENT_LIMIT = 100;
export const MAX_ID_OFFSET = 1_000_000;

/**
 * Body of POST /search/index. The filters are those of /search; paging uses the id window instead of
 * from and size, and symbol_openfigi is not a filter. Unknown keys are rejected.
 */
export type SearchIndexRequest = Omit<
  InstrumentSearchQuery,
  'from' | 'size' | 'symbol_openfigi'
> & {
  // Defaults to all, deduplicated.
  include?: IncludeValue[];
  id_offset?: number;
  id_limit?: number;
  document_limit?: number;
  // indexed_at from an earlier response. Required when id_offset > 0.
  snapshot?: number;
};

export interface SearchIndexResponse {
  indexed_at: number;
  // Total matches before the id window.
  count?: number;
  // Ordered symbol_openfigi values of the window.
  ids?: string[];
  // null when no ids remain after the window.
  next_id_offset?: number | null;
  // Full documents of the first document_limit ids in the window, same order.
  documents?: InstrumentDocument[];
}
