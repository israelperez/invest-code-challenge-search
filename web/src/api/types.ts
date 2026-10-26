// Mirrors the API contract in docs/planning/PLAN.md.

export type OrderBy = `${'symbol' | 'display_name' | 'units_circulating'}.${'asc' | 'desc'}`;

export type SearchIndexRequest = {
  search_text?: string;
  kind?: string[];
  issuer?: string[];
  is_betashares?: { value: boolean };
  is_flagship_fund?: { value: boolean };
  is_portfolio_excluded?: { value: boolean };
  is_auto_invest_included?: { value: boolean };
  units_circulating?: { min?: string; max?: string };
  order_by?: OrderBy;
  include?: Array<'count' | 'facets' | 'ids' | 'documents'>;
  id_offset?: number;
  id_limit?: number;
  document_limit?: number;
  snapshot?: number;
};

export type InstrumentDocument = {
  symbol: string;
  symbol_openfigi: string;
  display_name: string;
  kind: string;
  currency: string;
  logo: string | null;
  issuer: string | null;
  is_betashares: boolean;
  is_flagship_fund: boolean;
  is_portfolio_excluded: boolean;
  is_auto_invest_included: boolean;
  units_circulating: string | null;
};

export type FacetEntry = { value: string; count: number };

export type SearchIndexResponse = {
  indexed_at: number;
  count?: number;
  facets?: Record<string, FacetEntry[]>;
  ids?: string[];
  next_id_offset?: number | null;
  documents?: InstrumentDocument[];
};

export type VersionResponse = { indexed_at: number };

export type InstrumentsBatchRequest = { ids: string[]; snapshot: number };

export type InstrumentsBatchResponse = {
  documents: InstrumentDocument[];
  missing: string[];
  indexed_at: number;
};

export type PopularTerm = { label: string; key: string; clients: number };

export type PopularResponse = { terms: PopularTerm[]; includes_seed_data: true };

export type ZeroResultSpelling = { text: string; total: number };

export type ZeroResultGroup = { key: string; clients: number; total: number; spellings: ZeroResultSpelling[] };

export type ZeroResultsResponse = { groups: ZeroResultGroup[]; includes_seed_data: true };

export type SuggestInstrumentsRequest = { search_text: string; size: number };

export type SuggestedInstrument = Pick<InstrumentDocument, 'symbol' | 'symbol_openfigi' | 'display_name' | 'logo'>;

export type SuggestInstrumentsResponse = { results: SuggestedInstrument[]; count: number; indexed_at: number };
