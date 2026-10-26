import { dedupeKey, executableSpelling } from './dedupe-key';
import {
  DEFAULT_SEARCH_LOG_CONFIG,
  SearchLogConfig,
} from './search-log.config';
import { TokenBucket } from './token-bucket';

export interface SearchSubmission {
  term: string;
  submissionId: string;
  clientId: string;
  ip: string;
}

export type SubmitOutcome =
  'recorded' | 'rate-limited' | 'empty-key' | 'duplicate';

export interface SpellingAggregate {
  spelling: string;
  // The most common original casing seen, trimmed and whitespace collapsed.
  display: string;
  count: number;
  unfiltered_count: number;
}

export interface KeyAggregate {
  key: string;
  spellings: SpellingAggregate[];
  distinct_clients: number;
  // Searches recorded, and those whose spelling had results; both survive spelling eviction.
  total: number;
  positive_total: number;
  has_positive_result: boolean;
  last_seen: number;
}

interface KeyEntry {
  spellings: Map<
    string,
    Omit<SpellingAggregate, 'display'> & {
      order: number;
      casings: Map<string, number>;
    }
  >;
  clients: Set<string>;
  total: number;
  positiveTotal: number;
  lastSeen: number;
}

/**
 * A fake history line for seeding: `searches` searches of `term` spread over `clients` clients.
 */
export interface SeedEntry {
  term: string;
  clients: number;
  searches: number;
}

/**
 * The log as saved to disk (version 1): the aggregates and the order counter, not the submission IDs,
 * token buckets or count memo, which are cheap to rebuild.
 */
export interface SearchLogSnapshot {
  version: 1;
  order: number;
  keys: {
    key: string;
    spellings: {
      spelling: string;
      count: number;
      unfiltered_count: number;
      order: number;
      casings: [string, number][];
    }[];
    clients: string[];
    total: number;
    positiveTotal: number;
    lastSeen: number;
  }[];
}

export interface SearchLogDeps {
  clock: () => number;
  // Unfiltered result count for an executable spelling.
  countFor: (spelling: string) => Promise<number>;
  // Called after each recorded search (not seeding), e.g. to save.
  onRecorded?: () => void;
  config?: Partial<SearchLogConfig>;
}

/**
 * In-memory log of explicit searches (ADR 0002). Aggregates are bounded; see SearchLogConfig.
 */
export class SearchLog {
  private config: SearchLogConfig;
  private ipBucket: TokenBucket;
  private clientBucket: TokenBucket;
  private submissions = new Map<string, number>();
  private inFlight = new Map<string, Promise<void>>();
  private memo = new Map<string, Promise<number>>();
  private keys = new Map<string, KeyEntry>();
  private order = 0;

  constructor(private deps: SearchLogDeps) {
    this.config = { ...DEFAULT_SEARCH_LOG_CONFIG, ...deps.config };
    this.ipBucket = new TokenBucket(this.config.ipRate, deps.clock);
    this.clientBucket = new TokenBucket(this.config.clientRate, deps.clock);
  }

  async submit(submission: SearchSubmission): Promise<SubmitOutcome> {
    const { term, submissionId, clientId, ip } = submission;

    const key = dedupeKey(term);
    if (!key) {
      return 'empty-key';
    }

    // A retry racing the first attempt waits for its outcome; if that fails, so does the retry.
    const pending = this.inFlight.get(submissionId);
    if (pending) {
      await pending;
      return 'duplicate';
    }
    if (this.registered(submissionId)) {
      return 'duplicate';
    }

    // Only a genuinely new attempt costs tokens, so duplicates and racing retries are never limited.
    if (!(this.ipBucket.take(ip) && this.clientBucket.take(clientId))) {
      devLog('search-log.rate-limited');
      return 'rate-limited';
    }

    const attempt = this.record(key, term, clientId, submissionId);
    this.inFlight.set(submissionId, attempt);
    try {
      await attempt;
      return 'recorded';
    } finally {
      this.inFlight.delete(submissionId);
    }
  }

  /**
   * Every key's aggregates, for popular searches and zero-result insights.
   */
  aggregates(): KeyAggregate[] {
    return [...this.keys].map(([key, entry]) => ({
      key,
      spellings: [...entry.spellings.values()].map(
        ({ spelling, count, unfiltered_count, casings }) => ({
          spelling,
          display: [...casings].reduce((a, b) => (b[1] > a[1] ? b : a))[0],
          count,
          unfiltered_count,
        }),
      ),
      distinct_clients: entry.clients.size,
      total: entry.total,
      positive_total: entry.positiveTotal,
      has_positive_result: entry.positiveTotal > 0,
      last_seen: entry.lastSeen,
    }));
  }

  snapshot(): SearchLogSnapshot {
    return {
      version: 1,
      order: this.order,
      keys: [...this.keys].map(([key, entry]) => ({
        key,
        spellings: [...entry.spellings.values()].map(({ spelling, count, unfiltered_count, order, casings }) => ({
          spelling,
          count,
          unfiltered_count,
          order,
          casings: [...casings],
        })),
        clients: [...entry.clients],
        total: entry.total,
        positiveTotal: entry.positiveTotal,
        lastSeen: entry.lastSeen,
      })),
    };
  }

  /**
   * Replaces the aggregates with a snapshot, cut to the config bounds so a hand-edited file can't exceed them.
   */
  restore(snapshot: SearchLogSnapshot) {
    const { maxKeys, maxSpellingsPerKey, maxClientsPerKey, maxCasingsPerSpelling } = this.config;
    this.keys = new Map(
      snapshot.keys.slice(0, maxKeys).map(({ key, spellings, clients, total, positiveTotal, lastSeen }) => [
        key,
        {
          spellings: new Map(
            spellings.slice(0, maxSpellingsPerKey).map(({ casings, ...rest }) => [
              rest.spelling,
              { ...rest, casings: new Map(casings.slice(0, maxCasingsPerSpelling)) },
            ]),
          ),
          clients: new Set(clients.slice(0, maxClientsPerKey)),
          total,
          positiveTotal,
          lastSeen,
        },
      ]),
    );
    this.order = snapshot.order;
  }

  /**
   * Empties the log and forgets submission IDs and counts, as on a fresh start (the development reset).
   * shortcut: a search counting while this runs can still land afterwards, fine for a demo reset.
   */
  clear() {
    this.restore({ version: 1, order: 0, keys: [] });
    this.submissions.clear();
    this.memo.clear();
  }

  /**
   * Swaps the history for `entries` (counted like seed()). All-or-nothing: if any count fails, the old history stays.
   */
  async replaceWith(entries: SeedEntry[]): Promise<void> {
    const next = new SearchLog({ ...this.deps, onRecorded: undefined });
    await next.seed(entries);
    this.clear();
    this.restore(next.snapshot());
  }

  /**
   * Adds a fake history through the normal aggregation (real counts, keys, spellings), skipping rate
   * limits and the submission ID registry. Entries with an empty dedupe key are ignored. All-or-nothing: if any count fails, nothing is added.
   */
  async seed(entries: SeedEntry[]): Promise<void> {
    // All counts first: a failed count adds nothing, never a partial history.
    const keyed = entries.flatMap((entry) => {
      const key = dedupeKey(entry.term);
      return key ? [{ ...entry, key }] : [];
    });
    const counts = await Promise.all(
      keyed.map(({ term }) => this.unfilteredCount(executableSpelling(term))),
    );
    keyed.forEach(({ key, term, clients, searches }, index) => {
      for (let n = 0; n < searches; n++) {
        this.add(key, term, `seed-${index}-${n % clients}`, counts[index]);
      }
    });
  }

  /**
   * Counts, records, then commits the submission ID. A failed count commits nothing, so the retry
   * with the same ID is recorded.
   */
  private async record(
    key: string,
    term: string,
    clientId: string,
    submissionId: string,
  ) {
    const spelling = executableSpelling(term);
    let unfilteredCount: number;
    try {
      unfilteredCount = await this.unfilteredCount(spelling);
    } catch (error) {
      devLog('search-log.count-failed');
      throw error;
    }
    this.add(key, term, clientId, unfilteredCount);
    this.register(submissionId);
    this.deps.onRecorded?.();
  }

  /**
   * True when the ID was committed inside the retry window. Entries are in insertion (so age) order,
   * which makes expiry and oldest-first eviction both a read from the front.
   */
  private registered(submissionId: string): boolean {
    const now = this.deps.clock();
    for (const [id, at] of this.submissions) {
      if (now - at <= this.config.submissionTtlMs) {
        break;
      }
      this.submissions.delete(id);
    }
    return this.submissions.has(submissionId);
  }

  private register(submissionId: string) {
    this.submissions.set(submissionId, this.deps.clock());
    if (this.submissions.size > this.config.maxSubmissionIds) {
      this.submissions.delete(this.submissions.keys().next().value as string);
    }
  }

  private unfilteredCount(spelling: string): Promise<number> {
    let count = this.memo.get(spelling);
    if (!count) {
      count = this.deps.countFor(spelling);
      // A failed count must not stay memoised.
      count.catch(() => this.memo.delete(spelling));
      this.memo.set(spelling, count);
      if (this.memo.size > this.config.maxMemoSpellings) {
        this.memo.delete(this.memo.keys().next().value as string);
      }
    }
    return count;
  }

  private add(
    key: string,
    term: string,
    clientId: string,
    unfilteredCount: number,
  ) {
    const spelling = executableSpelling(term);
    const casing = term.trim().replace(/\s+/g, ' ');
    let entry = this.keys.get(key);
    if (!entry) {
      entry = {
        spellings: new Map(),
        clients: new Set(),
        total: 0,
        positiveTotal: 0,
        lastSeen: 0,
      };
      this.keys.set(key, entry);
    }

    entry.total += 1;
    entry.positiveTotal += unfilteredCount > 0 ? 1 : 0;
    entry.lastSeen = this.deps.clock();
    if (entry.clients.size < this.config.maxClientsPerKey) {
      entry.clients.add(clientId);
    }

    const existing = entry.spellings.get(spelling);
    if (existing) {
      existing.count += 1;
      this.countCasing(existing.casings, casing);
    } else {
      entry.spellings.set(spelling, {
        spelling,
        count: 1,
        unfiltered_count: unfilteredCount,
        order: this.order++,
        casings: new Map([[casing, 1]]),
      });
      if (entry.spellings.size > this.config.maxSpellingsPerKey) {
        this.evictSpelling(entry);
      }
    }

    if (this.keys.size > this.config.maxKeys) {
      this.evictKey();
    }
  }

  // Casings past the bound are not counted (saturating), like clients.
  private countCasing(casings: Map<string, number>, casing: string) {
    const seen = casings.get(casing);
    if (seen !== undefined || casings.size < this.config.maxCasingsPerSpelling) {
      casings.set(casing, (seen ?? 0) + 1);
    }
  }

  private evictSpelling(entry: KeyEntry) {
    const victim = [...entry.spellings.values()].reduce((a, b) =>
      b.count < a.count || (b.count === a.count && b.order < a.order) ? b : a,
    );
    entry.spellings.delete(victim.spelling);
    devLog('search-log.evicted', { kind: 'spelling' });
  }

  // shortcut: scans every key per eviction (O(maxKeys)), upgrade to a heap if inserts get hot.
  private evictKey() {
    let victim: [string, KeyEntry] | undefined;
    for (const candidate of this.keys) {
      const [, entry] = candidate;
      if (
        !victim ||
        entry.clients.size < victim[1].clients.size ||
        (entry.clients.size === victim[1].clients.size &&
          entry.lastSeen < victim[1].lastSeen)
      ) {
        victim = candidate;
      }
    }
    if (victim) {
      this.keys.delete(victim[0]);
      devLog('search-log.evicted', { kind: 'key' });
    }
  }
}

/**
 * One JSON line for development. Callers never pass term data.
 */
export function devLog(event: string, fields: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ event, ...fields }));
}
