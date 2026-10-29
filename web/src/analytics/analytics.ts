import { printArgs, type Report } from '../search/report';

export type SearchTrigger = 'typed' | 'suggestion' | 'popular' | 'recent';

// Product events: what users do. Problems arrive through `report` instead, named by search/report.ts.
export type ProductEvents = {
  search_submitted: { term: string; source: SearchTrigger };
  suggestion_selected: { query: string; value: string; kind: 'term' | 'instrument' };
  search_zero_results: { term: string };
};

export type Analytics = { track: <E extends keyof ProductEvents>(event: E, data: ProductEvents[E]) => void };

type Sink = (level: 'info' | 'warn' | 'error', ...args: unknown[]) => void;

// Plain bold prefix: readable in light and dark DevTools.
const consoleSink: Sink = (level, ...args) => console[level]('%c[analytics]', 'font-weight: bold', ...args);

// Display only: the server-side search log is the source of truth (ADR 0002).
export function createAnalytics({ sink = consoleSink }: { sink?: Sink } = {}) {
  const track: Analytics['track'] = (event, data) => sink('info', event, data);
  const report: Report = (event, problem) => sink(problem.level, event, ...printArgs(problem));
  return { track, report };
}
