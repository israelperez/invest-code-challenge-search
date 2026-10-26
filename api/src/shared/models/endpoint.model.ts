/**
 * Full route paths, mirroring the real Search API routes.
 */
export enum ApiEndpoint {
  Health = '/',
  Search = '/search',
  SearchIndex = '/search/index',
  Searches = '/searches',
  Popular = '/popular',
  ZeroResults = '/insights/zero-results',
  SearchLogAdmin = '/search-log',
  SearchLogRestoreSeed = '/search-log/restore-seed',
  Version = '/version',
  Instrument = '/instruments/:id',
  InstrumentsBatch = '/instruments/batch',
  FacetKeys = '/facets/keys',
  FacetKeysByKind = '/v2/facets/keys',
  FacetCounts = '/facets/:key',
}

export enum RouteParam {
  Id = 'id',
  Key = 'key',
}

export enum QueryParam {
  Fields = 'fields',
  OmitEmptyCounts = 'omit_empty_counts',
}
