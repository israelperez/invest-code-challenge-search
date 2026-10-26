export const DEFAULT_POPULAR_LIMIT = 10;
export const MAX_POPULAR_LIMIT = 50;

/**
 * Strictly validates GET /popular query params. Returns the limit, or a message for the first
 * problem. Unknown or repeated params are rejected.
 */
export function validatePopularQuery(
  query: Record<string, unknown>,
): { limit: number } | { error: string } {
  const unknownKey = Object.keys(query).find((key) => key !== 'limit');
  if (unknownKey) {
    return { error: `Unknown query parameter: ${unknownKey}` };
  }
  if (query.limit === undefined) {
    return { limit: DEFAULT_POPULAR_LIMIT };
  }

  const limit = typeof query.limit === 'string' ? Number(query.limit) : NaN;
  if (
    !/^\d+$/.test(String(query.limit)) ||
    limit < 1 ||
    limit > MAX_POPULAR_LIMIT
  ) {
    return { error: `limit must be an integer from 1 to ${MAX_POPULAR_LIMIT}` };
  }
  return { limit };
}
