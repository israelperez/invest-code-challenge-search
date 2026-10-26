const MAX_TERM = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * Strictly validates a POST /searches body and its X-Client-Id header.
 * Returns a message for the first problem, or null when valid. Unknown fields are rejected.
 */
export function validateSearchLogRequest(
  body: unknown,
  clientId: string,
): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }

  const record = body as Record<string, unknown>;
  const unknownKey = Object.keys(record).find(
    (key) => key !== 'term' && key !== 'submission_id',
  );
  if (unknownKey) {
    return `Unknown field: ${unknownKey}`;
  }

  if (
    !(
      typeof record.term === 'string' &&
      record.term.length >= 1 &&
      record.term.length <= MAX_TERM
    )
  ) {
    return `term must be a string of 1 to ${MAX_TERM} characters`;
  }

  if (!isUuid(record.submission_id)) {
    return 'submission_id must be a UUID';
  }

  if (!isUuid(clientId)) {
    return 'X-Client-Id header must be a UUID';
  }

  return null;
}
