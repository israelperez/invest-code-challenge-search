import { BucketRate } from './token-bucket';

/**
 * Search log limits. Each bound exists so spoofed or random input can't grow memory without limit.
 */
export interface SearchLogConfig {
  // Distinct dedupe keys kept.
  maxKeys: number;
  // Distinct clients counted per key; further clients are not counted (saturating).
  maxClientsPerKey: number;
  // Spellings kept per key.
  maxSpellingsPerKey: number;
  // Original casings counted per spelling, for its display form; further casings are not counted.
  maxCasingsPerSpelling: number;
  // Submission IDs remembered for idempotency.
  maxSubmissionIds: number;
  // How long a submission ID makes a retry a no-op.
  submissionTtlMs: number;
  // Spellings whose unfiltered count is remembered.
  maxMemoSpellings: number;
  // How long after a recorded search the log file is rewritten; searches in between share one write.
  saveDebounceMs: number;
  // Token bucket per IP and per client ID.
  ipRate: BucketRate;
  clientRate: BucketRate;
}

export const DEFAULT_SEARCH_LOG_CONFIG: SearchLogConfig = {
  maxKeys: 5000,
  maxClientsPerKey: 1000,
  maxSpellingsPerKey: 10,
  maxCasingsPerSpelling: 5,
  maxSubmissionIds: 10_000,
  submissionTtlMs: 10 * 60_000,
  maxMemoSpellings: 10_000,
  saveDebounceMs: 1000,
  ipRate: { perMinute: 60, burst: 20 },
  clientRate: { perMinute: 20, burst: 10 },
};
