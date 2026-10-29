import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../analytics/analytics';
import { countProblems, createProblemCounter, DISTINCT_CAP } from './problem-counter';

afterEach(() => vi.restoreAllMocks());

describe('problem counter', () => {
  it('counts per event name', () => {
    const counter = createProblemCounter();
    counter.record('logo_failed');
    counter.record('logo_failed');
    counter.record('batch_incomplete');
    const s = counter.getSnapshot();
    expect([s.logo_failed?.count, s.batch_incomplete?.count, s.load_more_failed]).toEqual([2, 1, undefined]);
  });

  it('keeps the affected entries, each distinct one once, in first-seen order', () => {
    const counter = createProblemCounter();
    counter.record('batch_ids_missing', ['B:AU', 'A:AU']);
    counter.record('batch_ids_missing', ['A:AU', 'C:AU']);
    expect(counter.getSnapshot().batch_ids_missing).toEqual({ count: 2, entries: ['B:AU', 'A:AU', 'C:AU'], distinct: 3 });
  });

  it('caps the kept entries at 10 while the count and distinct total keep rising', () => {
    const counter = createProblemCounter();
    for (let i = 0; i < 12; i++) counter.record('logo_failed', [`X${i}`]);
    counter.record('logo_failed', ['X0']);
    const { count, entries, distinct } = counter.getSnapshot().logo_failed!;
    expect([count, entries, distinct]).toEqual([13, Array.from({ length: 10 }, (_, i) => `X${i}`), 12]);
  });

  it('stops tracking distinct entries at the cap while the count keeps rising', () => {
    const counter = createProblemCounter();
    for (let i = 0; i < DISTINCT_CAP + 5; i++) counter.record('logo_failed', [`X${i}`]);
    const { count, distinct, entries } = counter.getSnapshot().logo_failed!;
    expect([count, distinct, entries.length]).toEqual([DISTINCT_CAP + 5, DISTINCT_CAP, 10]);
  });

  it('stops accepting new keys past the cap', () => {
    const counter = createProblemCounter();
    for (let i = 0; i < DISTINCT_CAP; i++) expect(counter.firstTime('logo_failed', `X${i}`)).toBe(true);
    expect(counter.firstTime('logo_failed', 'new')).toBe(false);
    expect(counter.firstTime('no_display_name', 'new')).toBe(true);
  });

  it('keeps no entries for an event reported without any', () => {
    const counter = createProblemCounter();
    counter.record('snapshot_stale');
    expect(counter.getSnapshot().snapshot_stale).toEqual({ count: 1, entries: [], distinct: 0 });
  });

  it('notifies subscribers on a change and stops after unsubscribe', () => {
    const counter = createProblemCounter();
    const listener = vi.fn();
    const unsubscribe = counter.subscribe(listener);
    counter.record('load_more_failed');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    counter.record('load_more_failed');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns the same snapshot until something is recorded', () => {
    const counter = createProblemCounter();
    expect(counter.getSnapshot()).toBe(counter.getSnapshot());
    const before = counter.getSnapshot();
    counter.record('restart_failed');
    expect(counter.getSnapshot()).not.toBe(before);
    expect(before).toEqual({});
  });

  it('accepts a key once per event, then refuses it', () => {
    const counter = createProblemCounter();
    expect(counter.firstTime('logo_failed', 'A:AU')).toBe(true);
    expect(counter.firstTime('logo_failed', 'A:AU')).toBe(false);
    expect(counter.firstTime('no_display_name', 'A:AU')).toBe(true);
    expect(counter.firstTime('logo_failed', 'B:AU')).toBe(true);
  });
});

describe('countProblems', () => {
  it('counts, keeps entries and still forwards to the sink', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const counter = createProblemCounter();
    const sink = createAnalytics().report;
    countProblems(counter, sink)('first_batch_failed', { level: 'error', message: 'failed', entries: ['etf: Failed to fetch'] });
    expect(counter.getSnapshot().first_batch_failed).toEqual({ count: 1, entries: ['etf: Failed to fetch'], distinct: 1 });
    expect(error).toHaveBeenCalledTimes(1);
  });
});
