import { useRef, useState } from 'react';

// Wraps a retry so the failure message can stay mounted, with its button spinning, until the retry settles.
// Needed because a query that never had data goes back to pending on refetch, which would clear its error mid-flight.
// `key` identifies the request being retried: any key change drops the active retry for good (so A to B to A never revives
// A's), and a late finish of an abandoned retry cannot clear a newer one.
export function useRetry(run: () => Promise<unknown>, key: unknown) {
  const [active, setActive] = useState<{ id: number } | null>(null);
  const [seen, setSeen] = useState(key);
  const lastId = useRef(0);
  if (!Object.is(seen, key)) {
    setSeen(key);
    setActive(null);
  }
  const retry = async () => {
    const id = ++lastId.current;
    setActive({ id });
    try {
      await run();
    } finally {
      setActive((current) => (current?.id === id ? null : current));
    }
  };
  return { retrying: active !== null, retry };
}
