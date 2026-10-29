// Data and API problems the search code reports by stable name. Analytics (M2) can take them over; this default just prints them.
export type ProblemEvent =
  | 'batch_ids_missing'
  | 'batch_incomplete'
  | 'late_response_discarded'
  | 'snapshot_stale'
  | 'major_failure'
  | 'api_call_failed'
  | 'logo_failed'
  | 'no_display_name';

// `entries` names what was affected, for the Data problems section (one short string each); omit it to be counted only.
export type Problem = { level: 'warn' | 'error'; message: string; detail?: unknown; entries?: string[] };

export type Report = (event: ProblemEvent, problem: Problem) => void;

// Message, then detail, then entries, each only when present: the console says what the Data problems section says.
export const printArgs = ({ message, detail, entries }: Problem) => [message, ...(detail === undefined ? [] : [detail]), ...(entries?.length ? [entries] : [])];

export const consoleReport: Report = (_event, problem) => console[problem.level](...printArgs(problem));
