import type { ApiClient } from '../api/client';

/**
 * Logs every explicit search to the server, fire-and-forget: never awaited and never aborted, so a
 * superseded search is still logged. The API client retries and reports a failure; this only keeps it
 * from becoming an unhandled rejection.
 */
export function createSearchLogger(api: Pick<ApiClient, 'logSearch'>, clientId: () => string) {
  return (term: string) => {
    if (!term.trim()) return;
    api.logSearch(term, crypto.randomUUID(), clientId()).catch(() => undefined);
  };
}
