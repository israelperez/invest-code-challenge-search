import type { ProblemEvent, Report } from '../search/report';

// The most distinct affected items kept per event; the count keeps counting everything.
export const ENTRY_CAP = 10;
// The most distinct entries (and once-only keys) tracked per event, so a long session cannot grow memory without bound.
export const DISTINCT_CAP = 1000;

export type ProblemSummary = { count: number; entries: readonly string[]; distinct: number };
export type ProblemCounts = Readonly<Partial<Record<ProblemEvent, ProblemSummary>>>;

// Per-session, in memory only: a reload resets it. Shaped for useSyncExternalStore.
export function createProblemCounter() {
  let counts: ProblemCounts = {};
  const listeners = new Set<() => void>();
  const seen = new Map<ProblemEvent, Set<string>>();
  // Every distinct entry per event, so `distinct` stays exact past the cap.
  const keys = new Map<ProblemEvent, Set<string>>();
  return {
    record(event: ProblemEvent, entries: string[] = []) {
      const all = keys.get(event) ?? new Set<string>();
      keys.set(event, all);
      const before = counts[event] ?? { count: 0, entries: [], distinct: 0 };
      const kept = [...before.entries];
      for (const entry of entries) {
        if (all.has(entry) || all.size >= DISTINCT_CAP) continue;
        all.add(entry);
        if (kept.length < ENTRY_CAP) kept.push(entry);
      }
      counts = { ...counts, [event]: { count: before.count + 1, entries: kept, distinct: all.size } };
      listeners.forEach((l) => l());
    },
    // True the first time an event is seen for a key (an instrument ID), so re-renders and re-searches do not inflate the count.
    firstTime(event: ProblemEvent, key: string) {
      const keys = seen.get(event) ?? new Set<string>();
      seen.set(event, keys);
      // Past the cap new keys are no longer reported (and so no longer counted), the price of bounded memory.
      if (keys.has(key) || keys.size >= DISTINCT_CAP) return false;
      keys.add(key);
      return true;
    },
    getSnapshot: () => counts,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
export type ProblemCounter = ReturnType<typeof createProblemCounter>;

// Counts every problem whether or not analytics is on, then hands it to the sink. The sink gets every entry (the console is the full-detail channel); the counter keeps a bounded view for the panel.
export const countProblems = (counter: ProblemCounter, sink: Report): Report => (event, problem) => {
  counter.record(event, problem.entries);
  sink(event, problem);
};
