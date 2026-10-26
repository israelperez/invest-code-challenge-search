import { InstrumentDocument } from '../models/instrument.model';
import {
  FACET_FIELDS,
  FacetField,
  RANGE_FACET_BUCKETS,
  isBooleanField,
  isRangeField,
} from '../models/search-fields.config';
import { FacetResult } from '../models/search-query.model';
import { SearchIndexRequest } from '../models/search-index.model';
import { SearchService } from './search.service';

export type IndexFacets = Record<FacetField, FacetResult[]>;

/**
 * Counts every facet option for a request. Each option's count is the result count if it alone were
 * selected in its section, with every other section applied. That takes one pass for the request
 * plus one per active facet, which is searched without its own filter. The options are the values
 * across all documents, so options with no matches show a count of 0.
 */
export async function countFacets(
  searchService: SearchService,
  request: SearchIndexRequest,
  matches: InstrumentDocument[],
  all: InstrumentDocument[],
): Promise<IndexFacets> {
  const facets = {} as IndexFacets;

  for (const key of FACET_FIELDS) {
    const results = isActive(request, key)
      ? await searchService.searchAll({ ...request, [key]: undefined })
      : matches;

    facets[key] = optionsOf(key, all).map(([value, test]) => ({
      value,
      count: results.filter((document) => test(document)).length,
    }));
  }

  return facets;
}

/**
 * Whether the request filters on the facet key.
 */
function isActive(request: SearchIndexRequest, key: FacetField): boolean {
  if (isBooleanField(key)) {
    return typeof request[key]?.value === 'boolean';
  }
  if (isRangeField(key)) {
    return Boolean(request[key]?.min || request[key]?.max);
  }
  return Boolean(request[key]?.length);
}

/**
 * Each option of a facet as its value and a test for a document belonging to it.
 */
function optionsOf(
  key: FacetField,
  all: InstrumentDocument[],
): [string, (document: InstrumentDocument) => boolean][] {
  if (isRangeField(key)) {
    const edges = RANGE_FACET_BUCKETS[key];

    // Buckets are inclusive at both edges, like the range filter, so an edge value counts twice.
    return edges.slice(1).map((max, index) => [
      `${edges[index]},${max}`,
      (document) => {
        const value = document[key];
        return (
          value !== null &&
          parseFloat(value) >= edges[index] &&
          parseFloat(value) <= max
        );
      },
    ]);
  }

  const values = isBooleanField(key)
    ? ['true', 'false']
    : [
        ...new Set(
          all.map((document) => document[key]).filter((v) => v !== null),
        ),
      ].sort();

  return values.map((value) => [
    value,
    (document) => String(document[key]) === value,
  ]);
}
