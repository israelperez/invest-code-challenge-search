import type {
  FacetEntry,
  InstrumentsBatchRequest,
  InstrumentsBatchResponse,
  PopularResponse,
  ZeroResultsResponse,
  SearchIndexRequest,
  SearchIndexResponse,
  SuggestInstrumentsRequest,
  SuggestInstrumentsResponse,
  VersionResponse,
} from './types';
import { config } from '../config';
import type { Report } from '../search/report';

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

export type ApiClientOptions = {
  report?: Report;
  retries?: number;
  retryBaseMs?: number;
  timeoutMs?: number;
};

// Network errors, timeouts and 5xx are worth another go; a 4xx is the server's final answer (the 409 snapshot flow relies on it).
const retryable = (error: unknown) => !(error instanceof ApiError) || error.status >= 500;

// Resolves after `ms`, or rejects with the signal's reason as soon as it aborts.
const backoff = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export function createApiClient(
  baseUrl: string,
  { report = () => undefined, retries = config.apiRetries, retryBaseMs = config.apiRetryBaseMs, timeoutMs = config.apiTimeoutMs }: ApiClientOptions = {},
) {
  async function attempt<T>(path: string, init: RequestInit | undefined): Promise<T> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const response = await fetch(`${baseUrl}${path}`, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      throw new ApiError(response.status, `${init?.method ?? 'GET'} ${path} failed with ${response.status}`, body);
    }
    // 202 Accepted and 204 No Content have no body.
    if (response.status === 202 || response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  // The one gateway: per-attempt timeout, retries with doubling backoff, and a single report once it gives up.
  async function request<T>(caller: string, path: string, init?: RequestInit): Promise<T> {
    for (let tried = 0; ; tried++) {
      try {
        return await attempt<T>(path, init);
      } catch (error) {
        if (init?.signal?.aborted) throw error;
        if (retryable(error) && tried < retries) {
          await backoff(retryBaseMs * 2 ** tried, init?.signal ?? undefined);
          continue;
        }
        // 409 is the normal stale-snapshot flow, reported as snapshot_stale by its caller.
        if (!(error instanceof ApiError && error.status === 409)) {
          report('api_call_failed', {
            level: 'error',
            message: 'API call failed after retries',
            detail: error,
            entries: [`${caller}: ${error instanceof Error ? error.message : String(error)}`],
          });
        }
        throw error;
      }
    }
  }

  return {
    searchIndex: (body: SearchIndexRequest, signal?: AbortSignal) =>
      request<SearchIndexResponse>('search-index', '/search/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    instrumentsBatch: (body: InstrumentsBatchRequest, signal?: AbortSignal) =>
      request<InstrumentsBatchResponse>('instruments-batch', '/instruments/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    facetIssuer: (signal?: AbortSignal) =>
      request<FacetEntry[]>('facet-issuer', '/facets/issuer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal,
      }),
    // Legacy /search: size travels in the body, the fields to return in the query.
    suggestInstruments: (body: SuggestInstrumentsRequest, signal?: AbortSignal) =>
      request<SuggestInstrumentsResponse>('suggest-instruments', '/search?fields=symbol,symbol_openfigi,display_name,logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    popular: (limit: number, signal?: AbortSignal) => request<PopularResponse>('popular', `/popular?limit=${limit}`, { signal }),
    // Dev only: 404 when the API runs without ENABLE_INSIGHTS.
    zeroResults: (signal?: AbortSignal) => request<ZeroResultsResponse>('zero-results', '/insights/zero-results', { signal }),
    // Dev only (404 without ENABLE_INSIGHTS): empty the search log, or replace it with the demo seed.
    clearSearchLog: () => request<void>('clear-search-log', '/search-log', { method: 'DELETE' }),
    restoreSeed: () => request<void>('restore-seed', '/search-log/restore-seed', { method: 'POST' }),
    // Fire-and-forget log of an explicit search; the server answers 202 with no body.
    logSearch: (term: string, submissionId: string, clientId: string) =>
      request<void>('log-search', '/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId },
        body: JSON.stringify({ term, submission_id: submissionId }),
      }),
    version: (signal?: AbortSignal) => request<VersionResponse>('version', '/version', { signal }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
