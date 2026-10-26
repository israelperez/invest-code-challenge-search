import { KeyAggregate } from './search-log';

// Distinct clients a key needs before it is popular.
const MIN_CLIENTS = 3;

export interface PopularTerm {
  label: string;
  key: string;
  clients: number;
}

/**
 * Popular searches: keys with enough distinct clients, a spelling that returns results and no OR,
 * ranked by distinct clients then total. The label is the most frequent spelling that returns results.
 */
export function popularTerms(
  aggregates: KeyAggregate[],
  limit: number,
): PopularTerm[] {
  const terms: (PopularTerm & { total: number })[] = [];
  for (const { key, spellings, distinct_clients, total } of aggregates) {
    if (distinct_clients < MIN_CLIENTS || key.split(' ').includes('OR')) {
      continue;
    }
    const label = spellings
      .filter((s) => s.unfiltered_count > 0)
      .reduce<
        (typeof spellings)[number] | undefined
      >((a, b) => (a && a.count >= b.count ? a : b), undefined)?.display;
    if (label) {
      terms.push({ label, key, clients: distinct_clients, total });
    }
  }
  return terms
    .sort((a, b) => b.clients - a.clients || b.total - a.total)
    .slice(0, limit)
    .map(({ label, key, clients }) => ({ label, key, clients }));
}
