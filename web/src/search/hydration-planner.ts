export type HydrationPlan = {
  // IDs of the next batch that the loaded windows already cover, in order.
  batchIds: string[];
  // The subset of batchIds the store has no document for.
  missingIds: string[];
  // The loaded windows cannot fill a batch and another window exists: fetch it, then plan again.
  needsNextWindow: boolean;
  // No IDs left to show and no further window.
  exhausted: boolean;
};

// Pure: decides what the next load more needs, without fetching anything.
export function planHydration(input: {
  ids: string[];
  consumed: number;
  batchSize: number;
  // Everything left is taken at once when it is at most batchSize + orphanSize.
  orphanSize: number;
  // Total matches, to know how much is left.
  count: number;
  nextIdOffset: number | null;
  has: (id: string) => boolean;
}): HydrationPlan {
  const { ids, consumed, batchSize, orphanSize, count, nextIdOffset, has } = input;
  const remaining = count - consumed;
  const size = remaining <= batchSize + orphanSize ? remaining : batchSize;
  const batchIds = ids.slice(consumed, consumed + size);
  return {
    batchIds,
    missingIds: batchIds.filter((id) => !has(id)),
    needsNextWindow: batchIds.length < size && nextIdOffset !== null,
    exhausted: batchIds.length === 0 && nextIdOffset === null,
  };
}
