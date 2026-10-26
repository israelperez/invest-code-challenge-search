/**
 * Full route paths, mirroring the real Search API routes.
 */
export enum ApiEndpoint {
  Health = '/',
  Search = '/search',
  SearchIndex = '/search/index',
  Version = '/version',
  Instrument = '/instruments/:id',
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
