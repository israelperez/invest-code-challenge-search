import type {
  FacetEntry,
  InstrumentsBatchRequest,
  InstrumentsBatchResponse,
  SearchIndexRequest,
  SearchIndexResponse,
  SuggestInstrumentsRequest,
  SuggestInstrumentsResponse,
  VersionResponse,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // Parsed JSON error body, e.g. the 409 { message, indexed_at }; undefined when it is not JSON.
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export function createApiClient(baseUrl: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      throw new ApiError(response.status, `${init?.method ?? 'GET'} ${path} failed with ${response.status}`, body);
    }
    return (await response.json()) as T;
  }

  return {
    searchIndex: (body: SearchIndexRequest, signal?: AbortSignal) =>
      request<SearchIndexResponse>('/search/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    instrumentsBatch: (body: InstrumentsBatchRequest, signal?: AbortSignal) =>
      request<InstrumentsBatchResponse>('/instruments/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    facetIssuer: (signal?: AbortSignal) =>
      request<FacetEntry[]>('/facets/issuer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal,
      }),
    // Legacy /search: size travels in the body, the fields to return in the query.
    suggestInstruments: (body: SuggestInstrumentsRequest, signal?: AbortSignal) =>
      request<SuggestInstrumentsResponse>('/search?fields=symbol,symbol_openfigi,display_name,logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    version: (signal?: AbortSignal) => request<VersionResponse>('/version', { signal }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
