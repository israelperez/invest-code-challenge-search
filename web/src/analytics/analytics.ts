import type { Report } from '../search/report';

export type SearchTrigger = 'typed' | 'suggestion' | 'popular' | 'recent';

// Product events: what users do. Problems arrive through `report` instead, named by search/report.ts.
export type ProductEvents = {
  search_submitted: { term: string; source: SearchTrigger };
  suggestion_selected: { query: string; value: string; kind: 'term' | 'instrument' };
  search_zero_results: { term: string; filtered: boolean };
};

export type Analytics = { track: <E extends keyof ProductEvents>(event: E, data: ProductEvents[E]) => void };

type Sink = (level: 'info' | 'warn' | 'error', ...args: unknown[]) => void;

// Plain bold prefix: readable in light and dark DevTools.
const consoleSink: Sink = (level, ...args) => console[level]('%c[analytics]', 'font-weight: bold', ...args);

// Display only: the server-side search log is the source of truth (ADR 0002). `enabled` drops product
// events; problem reports always print, so a problem is never hidden by the flag.
export function createAnalytics({ enabled, sink = consoleSink }: { enabled: boolean; sink?: Sink }) {
  const track: Analytics['track'] = (event, data) => {
    if (enabled) sink('info', event, data);
  };
  const report: Report = (event, { level, message, detail }) =>
    detail === undefined ? sink(level, event, message) : sink(level, event, message, detail);
  return { track, report };
}
