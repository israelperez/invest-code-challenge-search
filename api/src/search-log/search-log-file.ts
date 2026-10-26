import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { DEFAULT_SEARCH_LOG_CONFIG } from './search-log.config';
import { SearchLog, SearchLogDeps, SearchLogSnapshot, SeedEntry, devLog } from './search-log';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

function isSnapshot(value: unknown): value is SearchLogSnapshot {
  return (
    isObject(value) &&
    value.version === 1 &&
    isNumber(value.order) &&
    Array.isArray(value.keys) &&
    value.keys.every(
      (k) =>
        isObject(k) &&
        typeof k.key === 'string' &&
        isNumber(k.total) &&
        isNumber(k.positiveTotal) &&
        isNumber(k.lastSeen) &&
        Array.isArray(k.clients) &&
        k.clients.every((c) => typeof c === 'string') &&
        Array.isArray(k.spellings) &&
        k.spellings.every(
          (s) =>
            isObject(s) &&
            typeof s.spelling === 'string' &&
            isNumber(s.count) &&
            isNumber(s.unfiltered_count) &&
            isNumber(s.order) &&
            Array.isArray(s.casings) &&
            s.casings.length > 0 &&
            s.casings.every((c) => Array.isArray(c) && typeof c[0] === 'string' && isNumber(c[1])),
        ),
    )
  );
}

// Written beside the target and renamed over it, so a crash never leaves a half-written file.
function writeSnapshot(file: string, snapshot: SearchLogSnapshot) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(snapshot));
  renameSync(temp, file);
}

export interface PersistentSearchLogDeps extends Omit<SearchLogDeps, 'onRecorded'> {
  file: string;
  // The demo history for the first start.
  loadSeed: () => SeedEntry[];
}

/**
 * A search log kept in a JSON file. The first start (no file) seeds and saves; later starts load the file.
 * An unreadable or invalid file is left untouched: the run starts from the seed and doesn't save.
 * `ready` resolves once loaded or seeded; `flush` writes any pending save now.
 */
export function createPersistentSearchLog({ file, loadSeed, ...deps }: PersistentSearchLogDeps) {
  const { saveDebounceMs } = { ...DEFAULT_SEARCH_LOG_CONFIG, ...deps.config };
  // Off until the log is loaded or seeded: an early flush (shutdown mid-seed) would save an empty log for good.
  let saving = false;
  let timer: NodeJS.Timeout | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!saving) return;
    try {
      writeSnapshot(file, searchLog.snapshot());
    } catch {
      devLog('search-log.save-failed');
    }
  };
  const searchLog = new SearchLog({
    ...deps,
    onRecorded: () => {
      // One write per window, not one per search.
      timer ??= setTimeout(flush, saveDebounceMs).unref();
    },
  });

  const seed = () =>
    Promise.resolve()
      .then(() => searchLog.seed(loadSeed()))
      .then(() => {
        saving = canSave;
        flush();
      })
      // A failed seed leaves the log empty, and nothing is saved so the next start seeds again.
      .catch(() => devLog('search-log.seed-failed'));

  let canSave = true;
  let ready: Promise<void>;
  if (!existsSync(file)) {
    ready = seed();
  } else {
    try {
      const snapshot: unknown = JSON.parse(readFileSync(file, 'utf-8'));
      if (!isSnapshot(snapshot)) throw new Error('invalid');
      searchLog.restore(snapshot);
      saving = true;
      ready = Promise.resolve();
    } catch {
      devLog('search-log.load-failed');
      devLog('search-log.save-disabled');
      canSave = false;
      ready = seed();
    }
  }
  return { searchLog, ready, flush };
}
