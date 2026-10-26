const STORAGE_KEY = 'instrument-search.recent-searches';

export type RecentSearchStore = {
  // Newest first. The same array is returned until something changes, so it suits useSyncExternalStore.
  list: () => readonly string[];
  add: (term: string) => void;
  subscribe: (listener: () => void) => () => void;
};

/**
 * This user's recent searches: held in memory and written through to localStorage. When storage is
 * unavailable or throws, the list lives in memory for the session instead.
 */
export function createRecentSearchStore(getStorage: () => Storage = () => localStorage, { limit }: { limit: number }): RecentSearchStore {
  // The one rule set for adding and loading: strings only, trimmed, no blanks, case-insensitive dedupe keeping the first (newest), capped.
  const clean = (list: readonly unknown[]): readonly string[] => {
    const seen = new Set<string>();
    return list
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
      .slice(0, limit);
  };
  const listeners = new Set<() => void>();
  const save = () => {
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(terms));
    } catch {
      // Memory-only for the session.
    }
  };

  let terms: readonly string[] = [];
  try {
    const stored = getStorage().getItem(STORAGE_KEY) ?? '[]';
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      terms = clean(parsed);
      if (JSON.stringify(terms) !== stored) save();
    }
  } catch {
    // Unreadable or corrupt: start empty.
  }

  function set(next: readonly string[]) {
    terms = next;
    save();
    listeners.forEach((listener) => listener());
  }

  return {
    list: () => terms,
    add(term) {
      if (term.trim()) set(clean([term, ...terms]));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
