import { KeyAggregate } from '../search-log/search-log';

// Distinct clients a key needs before it counts as a gap, not one person's typo.
const MIN_CLIENTS = 2;

export interface ZeroResultGroup {
  key: string;
  clients: number;
  total: number;
  spellings: { text: string; total: number }[];
}

/**
 * Zero-result insights: keys no spelling ever found results for and at least 2 distinct clients searched,
 * ranked by distinct clients then total, each with its spellings (most searched first).
 */
export function zeroResultGroups(
  aggregates: KeyAggregate[],
): ZeroResultGroup[] {
  return aggregates
    .filter((a) => !a.has_positive_result && a.distinct_clients >= MIN_CLIENTS)
    .map(({ key, distinct_clients, total, spellings }) => ({
      key,
      clients: distinct_clients,
      total,
      spellings: spellings
        .map((s) => ({ text: s.display, total: s.count }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.clients - a.clients || b.total - a.total);
}
