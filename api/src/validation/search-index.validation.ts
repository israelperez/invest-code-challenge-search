import {
  BOOLEAN_FIELDS,
  MULTI_SELECT_FIELDS,
  RANGE_FIELDS,
} from '../models/search-fields.config';
import {
  INCLUDE_VALUES,
  MAX_DOCUMENT_LIMIT,
  MAX_ID_LIMIT,
  MAX_ID_OFFSET,
  ORDER_BY_FIELDS,
} from '../models/search-index.model';

type JsonObject = Record<string, unknown>;

const MAX_SEARCH_TEXT = 100;
// Bounds for each multi-select filter and its values.
const MAX_FILTER_VALUES = 100;
const MAX_FILTER_VALUE_LENGTH = 100;
const MAX_RANGE_BOUND_LENGTH = 30;

// symbol_openfigi is a legacy filter, not part of this contract.
const FILTER_FIELDS: string[] = MULTI_SELECT_FIELDS.filter(
  (field) => field !== 'symbol_openfigi',
);
const ALLOWED_KEYS = new Set<string>([
  'search_text',
  'order_by',
  'include',
  'id_offset',
  'id_limit',
  'document_limit',
  'snapshot',
  ...FILTER_FIELDS,
  ...BOOLEAN_FIELDS,
  ...RANGE_FIELDS,
]);
const ORDER_BY_PATTERN = new RegExp(
  `^(${ORDER_BY_FIELDS.join('|')})\\.(asc|desc)$`,
);

/**
 * Strictly validates a POST /search/index body against SearchIndexRequest.
 * Returns a message for the first invalid key, or null when valid. Unknown keys are rejected.
 */
export function validateSearchIndexRequest(body: unknown): string | null {
  if (!isObject(body)) {
    return 'Request body must be a JSON object';
  }

  const unknownKey = Object.keys(body).find((key) => !ALLOWED_KEYS.has(key));
  if (unknownKey) {
    return `Unknown field: ${unknownKey}`;
  }

  if (
    body.search_text !== undefined &&
    !(
      typeof body.search_text === 'string' &&
      body.search_text.length <= MAX_SEARCH_TEXT
    )
  ) {
    return `search_text must be a string of at most ${MAX_SEARCH_TEXT} characters`;
  }

  if (
    body.order_by !== undefined &&
    !(typeof body.order_by === 'string' && ORDER_BY_PATTERN.test(body.order_by))
  ) {
    return `order_by must be one of ${ORDER_BY_FIELDS.join(', ')} followed by .asc or .desc`;
  }

  for (const field of FILTER_FIELDS) {
    const value = body[field];
    if (
      value !== undefined &&
      !(
        Array.isArray(value) &&
        value.length <= MAX_FILTER_VALUES &&
        value.every(
          (item) =>
            typeof item === 'string' && item.length <= MAX_FILTER_VALUE_LENGTH,
        )
      )
    ) {
      return `${field} must be an array of at most ${MAX_FILTER_VALUES} strings of at most ${MAX_FILTER_VALUE_LENGTH} characters`;
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    const filter = body[field];
    if (
      filter !== undefined &&
      !(
        isObject(filter) &&
        Object.keys(filter).length === 1 &&
        typeof filter.value === 'boolean'
      )
    ) {
      return `${field} must be an object like { "value": true }`;
    }
  }

  for (const field of RANGE_FIELDS) {
    const filter = body[field];
    if (filter === undefined) {
      continue;
    }
    if (
      !isObject(filter) ||
      Object.keys(filter).some((k) => k !== 'min' && k !== 'max')
    ) {
      return `${field} must be an object like { "min": "0", "max": "100" }`;
    }
    for (const bound of ['min', 'max']) {
      if (filter[bound] !== undefined && !isNumericString(filter[bound])) {
        return `${field}.${bound} must be a numeric string`;
      }
    }
  }

  if (
    body.include !== undefined &&
    !(
      Array.isArray(body.include) &&
      body.include.length <= INCLUDE_VALUES.length * 2 &&
      body.include.every((item) =>
        INCLUDE_VALUES.some((value) => value === item),
      )
    )
  ) {
    return `include must be an array of ${INCLUDE_VALUES.join(', ')}`;
  }

  const include = new Set<unknown>(body.include ?? INCLUDE_VALUES);

  if (include.has('documents') && !include.has('ids')) {
    return 'include "documents" requires "ids"';
  }

  const integerBounds: [string, number, number][] = [
    ['id_offset', 0, MAX_ID_OFFSET],
    ['id_limit', 1, MAX_ID_LIMIT],
    ['document_limit', 0, MAX_DOCUMENT_LIMIT],
  ];
  for (const [field, min, max] of integerBounds) {
    const value = body[field];
    if (
      value !== undefined &&
      !(
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= min &&
        value <= max
      )
    ) {
      return `${field} must be an integer from ${min} to ${max}`;
    }
  }

  const { snapshot } = body;
  if (
    snapshot !== undefined &&
    !(
      typeof snapshot === 'number' &&
      Number.isSafeInteger(snapshot) &&
      snapshot >= 0
    )
  ) {
    return 'snapshot must be a non-negative safe integer';
  }

  // The window is only used with ids, so snapshot is only required then.
  if (
    include.has('ids') &&
    Number(body.id_offset ?? 0) > 0 &&
    snapshot === undefined
  ) {
    return 'snapshot is required when id_offset is above 0';
  }

  return null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumericString(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length <= MAX_RANGE_BOUND_LENGTH &&
    value.trim() !== '' &&
    Number.isFinite(Number(value))
  );
}
