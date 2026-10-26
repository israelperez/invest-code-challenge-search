import {
  InstrumentDocument,
  InstrumentField,
} from '../models/instrument.model';
import {
  BOOLEAN_FIELDS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MULTI_SELECT_FIELDS,
  RANGE_FIELDS,
  TEXT_SEARCH_FIELDS,
  isRangeField,
} from '../models/search-fields.config';
import {
  InstrumentSearchQuery,
  SearchResults,
} from '../models/search-query.model';
import { InstrumentsRepository } from '../repositories/instruments-json.repository';

type SortValue = string | number | boolean | null;

export class SearchService {
  constructor(private repository: InstrumentsRepository) {}

  /**
   * Searches instruments in the same order of steps as the real Search API.
   */
  async search(query: InstrumentSearchQuery): Promise<SearchResults> {
    const [matches, indexed_at] = await Promise.all([
      this.searchAll(query),
      this.repository.getIndexedAt(),
    ]);

    // Count represents all matching results before pagination.
    const count = matches.length;
    const results = this.applyPagination(matches, query.from, query.size);

    return { results, count, indexed_at };
  }

  /**
   * Returns every instrument matching the query in result order, ignoring from and size.
   */
  async searchAll(query: InstrumentSearchQuery): Promise<InstrumentDocument[]> {
    let results = this.applyDefaultOrder(await this.repository.getAll());
    results = this.applyFilters(results, query);
    results = this.applyTextSearch(results, query.search_text);

    return this.applyOrderBy(results, query.order_by);
  }

  /**
   * Finds an instrument by its symbol_openfigi, ignoring case.
   */
  async getById(id: string): Promise<InstrumentDocument | null> {
    const documents = await this.repository.getAll();
    const symbolOpenfigi = id.toLowerCase();

    return (
      documents.find(
        (document) => document.symbol_openfigi.toLowerCase() === symbolOpenfigi,
      ) ?? null
    );
  }

  /**
   * Betashares instruments first, then by symbol.
   */
  private applyDefaultOrder(
    documents: InstrumentDocument[],
  ): InstrumentDocument[] {
    return [...documents].sort(
      (a, b) =>
        Number(b.is_betashares) - Number(a.is_betashares) ||
        compareValues(a.symbol, b.symbol),
    );
  }

  /**
   * Narrows results by the multi-select, boolean and range filters in the query.
   */
  private applyFilters(
    results: InstrumentDocument[],
    query: InstrumentSearchQuery,
  ): InstrumentDocument[] {
    // Multi-select: the value must equal one of the given values, ignoring case.
    for (const field of MULTI_SELECT_FIELDS) {
      const values = query[field]?.map((value) => value.toLowerCase());

      if (values?.length) {
        results = results.filter((document) => {
          const value = document[field];
          return value !== null && values.includes(value.toLowerCase());
        });
      }
    }

    // Boolean: the value must equal true or false. A null value applies no filter.
    for (const field of BOOLEAN_FIELDS) {
      const value = query[field]?.value;

      if (typeof value === 'boolean') {
        results = results.filter((document) => document[field] === value);
      }
    }

    // Range: the value must be within the inclusive min and max. Documents with no value are excluded.
    for (const field of RANGE_FIELDS) {
      const min = parseBound(query[field]?.min);
      const max = parseBound(query[field]?.max);

      if (min !== null || max !== null) {
        results = results.filter((document) => {
          const value = document[field];

          if (value === null) {
            return false;
          }

          const number = parseFloat(value);
          return (
            (min === null || number >= min) && (max === null || number <= max)
          );
        });
      }
    }

    return results;
  }

  /**
   * Keeps results matching the search text, best matches first. Matches with the same score keep
   * the default order. "OR" between words searches for either side.
   */
  private applyTextSearch(
    results: InstrumentDocument[],
    searchText: string | undefined,
  ): InstrumentDocument[] {
    const alternatives = (searchText ?? '')
      .split(/\s+OR\s+/)
      .map((alternative) => alternative.trim().toLowerCase())
      .filter(Boolean);

    if (alternatives.length === 0) {
      return results;
    }

    return results
      .map((document) => ({
        document,
        score: Math.max(
          ...alternatives.map((text) => scoreTextMatch(document, text)),
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ document }) => document);
  }

  /**
   * Re-orders results by order_by, e.g. "units_circulating.asc". Direction defaults to desc and
   * missing values always sort last. Unknown fields have no value, so the order is unchanged.
   */
  private applyOrderBy(
    results: InstrumentDocument[],
    orderBy: string | undefined,
  ): InstrumentDocument[] {
    if (!orderBy) {
      return results;
    }

    const [field, direction] = orderBy.split('.');
    const sign = direction === 'asc' ? 1 : -1;

    return [...results].sort((a, b) => {
      const aValue = getSortValue(a, field);
      const bValue = getSortValue(b, field);

      if (aValue === bValue) {
        return 0;
      }
      if (aValue === null) {
        return 1;
      }
      if (bValue === null) {
        return -1;
      }

      return compareValues(aValue, bValue) * sign;
    });
  }

  /**
   * Returns the requested page, where "from" is the page number starting at 1.
   */
  private applyPagination(
    results: InstrumentDocument[],
    from: number | undefined,
    size: number | undefined,
  ): InstrumentDocument[] {
    const page = from || DEFAULT_PAGE;
    const pageSize = size || DEFAULT_PAGE_SIZE;
    const start = (page - 1) * pageSize;

    return results.slice(start, start + pageSize);
  }
}

/**
 * Scores how well a document matches lower-cased search text, where 0 is no match.
 * Edit these tiers to change the search ranking.
 */
function scoreTextMatch(document: InstrumentDocument, text: string): number {
  const words = text.split(/\s+/);
  const symbol = document.symbol.toLowerCase();

  const containsEveryWord = (value: string | null) =>
    value !== null && words.every((word) => value.toLowerCase().includes(word));

  // Exact ticker, e.g. "a200" or "a200:au".
  if (symbol === text || document.symbol_openfigi.toLowerCase() === text) {
    return 4;
  }

  // Start of a ticker, e.g. "a2".
  if (symbol.startsWith(text)) {
    return 3;
  }

  // Every word in the name, e.g. "australia 200".
  if (containsEveryWord(document.display_name)) {
    return 2;
  }

  // Every word in any other text search field, e.g. "vaneck".
  if (TEXT_SEARCH_FIELDS.some((field) => containsEveryWord(document[field]))) {
    return 1;
  }

  return 0;
}

/**
 * Value used by order_by: range fields compare as numbers, unknown fields as missing.
 */
function getSortValue(document: InstrumentDocument, field: string): SortValue {
  if (!Object.hasOwn(document, field)) {
    return null;
  }

  const value = document[field as InstrumentField];

  return isRangeField(field) && value !== null
    ? parseFloat(String(value))
    : value;
}

function compareValues(
  a: NonNullable<SortValue>,
  b: NonNullable<SortValue>,
): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function parseBound(value: string | null | undefined): number | null {
  return value === undefined || value === null || value === ''
    ? null
    : parseFloat(value);
}
