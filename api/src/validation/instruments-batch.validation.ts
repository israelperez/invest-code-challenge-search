import { MAX_BATCH_IDS } from '../models/instruments-batch.model';

// Bounds the string before the regex runs.
const MAX_ID_LENGTH = 30;
const ID_PATTERN = /^[A-Z0-9.]+:[A-Z]{2}$/;
const ALLOWED_KEYS = new Set(['ids', 'snapshot']);

/**
 * Strictly validates a POST /instruments/batch body against InstrumentsBatchRequest.
 * Returns a message for the first problem, or null when valid. Unknown keys are rejected.
 */
export function validateInstrumentsBatchRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }

  const unknownKey = Object.keys(body).find((key) => !ALLOWED_KEYS.has(key));
  if (unknownKey) {
    return `Unknown field: ${unknownKey}`;
  }

  const { ids, snapshot } = body as Record<string, unknown>;

  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > MAX_BATCH_IDS ||
    !ids.every(
      (id) =>
        typeof id === 'string' &&
        id.length <= MAX_ID_LENGTH &&
        ID_PATTERN.test(id.toUpperCase()),
    )
  ) {
    return `ids must be an array of 1 to ${MAX_BATCH_IDS} IDs like "A200:AU"`;
  }

  if (
    !(
      typeof snapshot === 'number' &&
      Number.isSafeInteger(snapshot) &&
      snapshot >= 0
    )
  ) {
    return 'snapshot must be a non-negative safe integer';
  }

  return null;
}
