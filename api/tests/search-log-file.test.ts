import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { SearchLog } from '../src/search-log/search-log';
import { createPersistentSearchLog } from '../src/search-log/search-log-file';

const BIG = { perMinute: 1e9, burst: 1e9 };
const counts = (spelling: string) => Promise.resolve(spelling.includes('none') ? 0 : 5);
const submit = (log: SearchLog, term: string, clientId = crypto.randomUUID()) =>
  log.submit({ term, submissionId: crypto.randomUUID(), clientId, ip: '1.1.1.1' });
const tmpFile = () => join(mkdtempSync(join(tmpdir(), 'search-log-')), 'log.json');
const seed = [{ term: 'Gold', clients: 3, searches: 4 }];

function start(file: string, loadSeed = vi.fn(() => seed)) {
  const persistent = createPersistentSearchLog({
    file,
    clock: () => 1_000_000,
    countFor: counts,
    loadSeed,
    config: { ipRate: BIG, clientRate: BIG },
  });
  return { ...persistent, loadSeed };
}

let warn: MockInstance<typeof console.warn>;
const events = () => warn.mock.calls.map(([line]: unknown[]) => JSON.parse(String(line)).event);
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SearchLog snapshot and restore', () => {
  const make = (config = {}) => new SearchLog({ clock: () => 5, countFor: counts, config: { ipRate: BIG, clientRate: BIG, ...config } });

  it('round-trips the aggregates, casings included, and keeps aggregating', async () => {
    const log = make();
    await submit(log, 'Gold ETF');
    await submit(log, 'GOLD  etf');
    await submit(log, 'gold etf');
    await submit(log, 'etf none');

    const restored = make();
    restored.restore(JSON.parse(JSON.stringify(log.snapshot())));

    expect(restored.aggregates()).toEqual(log.aggregates());
    await submit(restored, 'gold etf');
    expect(restored.aggregates().find((a) => a.key === 'etf gold')?.total).toBe(4);
  });

  it('respects the bounds when the snapshot is larger', async () => {
    const big = make();
    for (const term of ['a', 'b', 'c']) await submit(big, term);
    for (const term of ['x y', 'y x', 'Y x']) await submit(big, term);
    const snapshot = big.snapshot();

    const small = make({ maxKeys: 2, maxClientsPerKey: 1, maxSpellingsPerKey: 1, maxCasingsPerSpelling: 1 });
    small.restore(snapshot);

    const aggregates = small.aggregates();
    expect(aggregates).toHaveLength(2);
    for (const entry of aggregates) {
      expect(entry.distinct_clients).toBe(1);
      expect(entry.spellings).toHaveLength(1);
    }
  });
});

describe('persistent search log', () => {
  it('seeds on the first start, then writes the file', async () => {
    const file = tmpFile();
    const { ready, searchLog, loadSeed } = start(file);
    await ready;

    expect(loadSeed).toHaveBeenCalledTimes(1);
    expect(searchLog.aggregates()).toHaveLength(1);
    expect(JSON.parse(readFileSync(file, 'utf-8')).version).toBe(1);
  });

  it('loads the file on a later start and does not seed', async () => {
    const file = tmpFile();
    const first = start(file);
    await first.ready;
    await submit(first.searchLog, 'silver');
    first.flush();

    const second = start(file);
    await second.ready;

    expect(second.loadSeed).not.toHaveBeenCalled();
    expect(second.searchLog.aggregates()).toEqual(first.searchLog.aggregates());
  });

  it.each([
    ['corrupt JSON', 'not json {'],
    ['a wrong version', JSON.stringify({ version: 2, order: 0, keys: [] })],
    ['a wrong shape', JSON.stringify({ version: 1, order: 0, keys: [{ key: 1 }] })],
  ])('falls back to the seed and leaves the file alone for %s', async (_name, content) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const file = tmpFile();
    writeFileSync(file, content);
    const { ready, searchLog, flush } = start(file);
    await ready;

    expect(searchLog.aggregates()).toHaveLength(1);
    await submit(searchLog, 'silver');
    await vi.advanceTimersByTimeAsync(5000);
    flush();

    expect(readFileSync(file, 'utf-8')).toBe(content);
    expect(events()).toContain('search-log.load-failed');
  });

  it('writes nothing when flushed during the first-start seed, so the next start still seeds', async () => {
    const file = tmpFile();
    const pending = createPersistentSearchLog({
      file,
      clock: () => 1_000_000,
      countFor: () => new Promise<number>(() => undefined),
      loadSeed: () => seed,
    });

    pending.flush();
    expect(existsSync(file)).toBe(false);

    const next = start(file);
    await next.ready;
    expect(next.loadSeed).toHaveBeenCalledTimes(1);
    expect(next.searchLog.aggregates()).not.toEqual([]);
  });

  it('saves a recorded search once the debounce has passed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const file = tmpFile();
    const { ready, searchLog } = start(file);
    await ready;
    const before = readFileSync(file, 'utf-8');

    await submit(searchLog, 'silver');
    expect(readFileSync(file, 'utf-8')).toBe(before);
    await vi.advanceTimersByTimeAsync(1000);

    expect(JSON.stringify(JSON.parse(readFileSync(file, 'utf-8')).keys)).toContain('silver');
  });

  it('dev-logs a failed write without term data and keeps recording', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { ready, searchLog } = start(join(tmpdir(), 'no-such-dir-for-search-log', 'log.json'));
    await ready;

    expect(await submit(searchLog, 'silver')).toBe('recorded');
    await vi.advanceTimersByTimeAsync(1000);

    expect(events()).toContain('search-log.save-failed');
    expect(warn.mock.calls.join()).not.toContain('silver');
  });
});
