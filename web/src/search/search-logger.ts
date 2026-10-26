import { ApiError, type ApiClient } from '../api/client';

/**
 * Logs every explicit search to the server, fire-and-forget: never awaited and never aborted, so a
 * superseded search is still logged. One retry after a network error or 5xx reuses the submission ID,
 * which the server treats as idempotent. Failures reach the console only, never the UI.
 */
export function createSearchLogger(
  api: Pick<ApiClient, 'logSearch'>,
  clientId: () => string,
  report: (error: unknown) => void = (error) => console.error('Search log failed', error),
) {
  return (term: string) => {
    if (!term.trim()) return;
    const submissionId = crypto.randomUUID();
    const send = () => api.logSearch(term, submissionId, clientId());
    send()
      .catch((error: unknown) => (retryable(error) ? send() : Promise.reject(error)))
      .catch(report);
  };
}

const retryable = (error: unknown) => !(error instanceof ApiError) || error.status >= 500;
