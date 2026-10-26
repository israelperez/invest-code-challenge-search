// Data and API problems the search code reports by stable name. Analytics (M2) can take them over; this default just prints them.
export type ProblemEvent =
  | 'batch_ids_missing'
  | 'batch_incomplete'
  | 'late_response_discarded'
  | 'snapshot_stale'
  | 'restart_failed'
  | 'first_batch_failed'
  | 'load_more_failed';

export type Problem = { level: 'warn' | 'error'; message: string; detail?: unknown };
export type Report = (event: ProblemEvent, problem: Problem) => void;

export const consoleReport: Report = (_event, { level, message, detail }) =>
  detail === undefined ? console[level](message) : console[level](message, detail);
