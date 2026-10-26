import { describe, expect, it, vi } from 'vitest';
import { createClientId } from './client-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const memoryStorage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } as Storage;
};

describe('client ID', () => {
  it('is a UUID created once and kept in storage', () => {
    const storage = memoryStorage();
    const clientId = createClientId(() => storage);

    const first = clientId();
    expect(first).toMatch(UUID);
    expect(clientId()).toBe(first);
  });

  it('is reused from storage by a later page load', () => {
    const storage = memoryStorage();
    const first = createClientId(() => storage)();

    expect(createClientId(() => storage)()).toBe(first);
  });

  it('replaces an invalid stored value with a persisted UUID', () => {
    const storage = memoryStorage();
    storage.setItem('instrument-search.client-id', 'not-a-uuid');

    const id = createClientId(() => storage)();

    expect(id).toMatch(UUID);
    expect(storage.getItem('instrument-search.client-id')).toBe(id);
  });

  it('stays stable in memory when localStorage throws', () => {
    const broken = () => {
      throw new Error('blocked');
    };
    const clientId = createClientId(broken);

    const first = clientId();
    expect(first).toMatch(UUID);
    expect(clientId()).toBe(first);
  });

  it('stays stable in memory when only writing fails', () => {
    const storage = { getItem: () => null, setItem: vi.fn(() => { throw new Error('full'); }) } as unknown as Storage;
    const clientId = createClientId(() => storage);

    expect(clientId()).toBe(clientId());
  });
});
