import type { SearchIndexRequest, SearchIndexResponse, VersionResponse } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApiClient(baseUrl: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!response.ok) throw new ApiError(response.status, `${init?.method ?? 'GET'} ${path} failed with ${response.status}`);
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
    version: (signal?: AbortSignal) => request<VersionResponse>('/version', { signal }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
