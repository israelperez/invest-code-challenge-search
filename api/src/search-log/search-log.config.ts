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
  // Submission IDs remembered for idempotency.
  maxSubmissionIds: number;
  // How long a submission ID makes a retry a no-op.
  submissionTtlMs: number;
  // Spellings whose unfiltered count is remembered.
  maxMemoSpellings: number;
  // Token bucket per IP and per client ID.
  ipRate: BucketRate;
  clientRate: BucketRate;
}

export const DEFAULT_SEARCH_LOG_CONFIG: SearchLogConfig = {
  maxKeys: 5000,
  maxClientsPerKey: 1000,
  maxSpellingsPerKey: 10,
  maxSubmissionIds: 10_000,
  submissionTtlMs: 10 * 60_000,
  maxMemoSpellings: 10_000,
  ipRate: { perMinute: 60, burst: 20 },
  clientRate: { perMinute: 20, burst: 10 },
};
