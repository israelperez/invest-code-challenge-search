const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_KEY = 'instrument-search.client-id';

/**
 * The anonymous client ID sent as X-Client-Id: a random UUID kept in localStorage and reused. When
 * storage is unavailable it lives in memory for the session instead.
 */
export function createClientId(getStorage: () => Storage = () => localStorage): () => string {
  let id: string | undefined;
  return () => {
    if (id) return id;
    try {
      const storage = getStorage();
      const stored = storage.getItem(STORAGE_KEY);
      // A corrupt stored value would make every log request a 400, so it is replaced.
      id = stored && UUID.test(stored) ? stored : undefined;
      if (!id) {
        id = crypto.randomUUID();
        storage.setItem(STORAGE_KEY, id);
      }
    } catch {
      id ??= crypto.randomUUID();
    }
    return id;
  };
}
