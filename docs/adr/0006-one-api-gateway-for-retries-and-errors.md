# One API gateway owns retries, timeouts and error reporting

Every API call goes through `request(caller, path, init)` in `web/src/api/client.ts`. It gives each attempt its own timeout, retries failures with doubling backoff, and reports a call that finally fails once, to the console and to the Data problems panel, as `api_call_failed` with an entry `<caller>: <message>` (`search-index`, `popular`, `log-search` and so on). The settings are `apiRetries`, `apiRetryBaseMs` and `apiTimeoutMs` in `web/src/config.ts`. Every other retry layer is off, so one outage is one sequence of attempts and one report. _Superseded 2026-10-30 (Israel): a call from a major caller (`search-index`, `instruments-batch`) that finally fails is reported as `major_failure`, not `api_call_failed`, and the page shows one message with Retry ([ADR 0007](./0007-one-message-for-major-api-failures.md)). Minor callers keep `api_call_failed`._

## Why

Before this, one outage gave 4 `searchIndex` calls and 4 `first_batch_failed` reports over about 7 seconds. TanStack Query's default 3 retries re-ran the whole `queryFn`, including its report, on every attempt. The client itself did not retry, and the search logger had one separate retry for the log call. The component tests hid it because their client had `retry: false`. Retries spread over several layers multiply the attempts, the waiting and the noise, and no single place says how long a user waits. With one gateway the worst case is known: 4 attempts, a 5 second timeout each, and waits of 250, 500 and 1000 ms, about 21 seconds.

Only network errors, timeouts and 5xx are retried, because those can pass on their own. A 4xx is the server's final answer, and the 409 snapshot flow depends on it: a stale snapshot must reach the caller at once so it can reload the first batch. A 409 is also not reported as `api_call_failed`, because it is already `snapshot_stale`. A caller abort (a new search, a closed panel) is not an error: it is never retried or reported, and an abort during backoff stops at once. Cancelling stays with callers through `AbortSignal`.

## Considered options

- **Leave TanStack Query's retries on.** Rejected: they re-run `queryFn`, so they repeat its reporting and would multiply the gateway's own attempts.
- **Retry in each caller (the search logger had its own).** Rejected: the policy would be written several times and drift. The logger's retry and the duplicate `console.error` calls in `SearchForm` and `PopularPills` are removed.
- **Retry 4xx as well.** Rejected: it would delay the 409 restart and retry requests that can never succeed.

## Consequences

- One outage now takes a few quick retries before the error and Retry button show, up to about 21 seconds in the worst case. A short blip never reaches the user.
- The search log keeps its idempotency on `submission_id` (ADR 0002), which is what makes retrying `POST /searches` safe.
- Failures are reported in one place, so the Data problems panel is the simulated error tracking: a real build would send the same report to an error-tracking service.
- Any new endpoint call must go through `request()` to get the timeout, retries and reporting.
