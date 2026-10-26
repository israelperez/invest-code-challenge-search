import { describe, expect, it, vi } from 'vitest';
import { createRecentSearchStore } from './recent-search-store';

const KEY = 'instrument-search.recent-searches';
const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as Storage;
};
const make = (storage = memoryStorage(), limit = 3) => ({ storage, store: createRecentSearchStore(() => storage, { limit }) });

describe('RecentSearchStore', () => {
  it('lists newest first', () => {
    const { store } = make();
    store.add('a200');
    store.add('vanguard');
    expect(store.list()).toEqual(['vanguard', 'a200']);
  });

  it('keeps only the newest `limit` terms', () => {
    const { store } = make();
    ['one', 'two', 'three', 'four'].forEach(store.add);
    expect(store.list()).toEqual(['four', 'three', 'two']);
  });

  it('dedupes case-insensitively, moving the term to the top with its newest casing', () => {
    const { store } = make();
    store.add('a200');
    store.add('vanguard');
    store.add('  A200 ');
    expect(store.list()).toEqual(['A200', 'vanguard']);
  });

  it('ignores blank terms', () => {
    const { store } = make();
    store.add('   ');
    expect(store.list()).toEqual([]);
  });

  it('writes through to storage and a new store reloads it', () => {
    const { storage, store } = make();
    store.add('a200');
    store.add('ndq');
    expect(JSON.parse(storage.getItem(KEY)!)).toEqual(['ndq', 'a200']);
    expect(make(storage).store.list()).toEqual(['ndq', 'a200']);
  });

  it('starts empty on corrupt or non-array stored JSON', () => {
    for (const bad of ['{nope', '{"a":1}', '"text"']) {
      const storage = memoryStorage();
      storage.setItem(KEY, bad);
      expect(make(storage).store.list()).toEqual([]);
    }
  });

  it('repairs stored entries with the same rules as add, and writes the repair back', () => {
    const storage = memoryStorage();
    storage.setItem(KEY, JSON.stringify(['', ' A200 ', 'a200', 42, '   ', 'ndq', 'NDQ', 'x', 'y']));
    const { store } = make(storage);
    expect(store.list()).toEqual(['A200', 'ndq', 'x']);
    expect(JSON.parse(storage.getItem(KEY)!)).toEqual(['A200', 'ndq', 'x']);
  });

  it('does not rewrite storage that is already clean', () => {
    const storage = memoryStorage();
    storage.setItem(KEY, JSON.stringify(['a200']));
    const setItem = vi.spyOn(storage, 'setItem');
    make(storage);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('stays memory-only when the repair cannot be written', () => {
    const storage = { getItem: () => JSON.stringify([' a200 ', 'A200']), setItem: () => { throw new Error('full'); } } as unknown as Storage;
    expect(createRecentSearchStore(() => storage, { limit: 3 }).list()).toEqual(['a200']);
  });

  it('keeps working in memory when storage throws', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    const store = createRecentSearchStore(() => broken, { limit: 3 });
    store.add('a200');
    expect(store.list()).toEqual(['a200']);
  });

  it('keeps working in memory when storage is unavailable', () => {
    const store = createRecentSearchStore(() => { throw new Error('no storage'); }, { limit: 3 });
    store.add('a200');
    expect(store.list()).toEqual(['a200']);
  });

  it('notifies subscribers on every change until they unsubscribe', () => {
    const { store } = make();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.add('a200');
    store.add('vanguard');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.add('ndq');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
