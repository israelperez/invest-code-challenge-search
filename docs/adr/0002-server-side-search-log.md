# Popular searches and zero-result insights come from a server-side search log

The browser sends every submitted search to a tiny `POST /searches { term, submission_id }` endpoint, idempotent on `submission_id` within a 10-minute retry window. It's a normal, non-blocking request: result rendering never waits for it, and failures only reach development logs. The server computes the term's unfiltered result count itself and records it with the dedupe key and an anonymous client ID. Popular searches (`GET /popular`) and zero-result insights (`GET /insights/zero-results`) are two views of that one log. Refinements are never logged. Logging is separate from `/search/index` so search results stay fully cacheable in the browser: a repeated search costs one tiny log request and no result request.

## Why

Popular means most searched across all users, which only a server can see. The client reports only the term; the server computes counts, so they can't be wrong or faked. Counting the term without filters means filter-induced zero results aren't mistaken for product gaps. Counts are computed per executable spelling, because spellings grouped under one dedupe key can return different results: popular labels a key with its most frequent spelling that returns results, and insights only shows keys where no spelling ever did. One log serves both needs Betashares has: terms that guide users (popular, with results) and terms that reveal product gaps (zero results).

## Considered options

- **Hard-coded popular list in the frontend.** Rejected: can't show real usage, and dedupe would live in the wrong place.
- **`POST /events` with client-reported counts.** Rejected: untrustworthy numbers.
- **Logging inside `/search/index`.** Rejected after Codex review: cached repeat searches never reach the server, so they'd go uncounted; bypassing the cache to fix it throws away the performance benefit.

## Consequences

- Popular pills are visible to every user, so the log is an attack surface. Ranking uses distinct clients rather than raw hits, a minimum distinct-client threshold applies, logging is rate limited per IP and per client, only terms with results qualify, and terms containing the `OR` operator are excluded so arbitrary text can't ride along with a real word.
- The log is in memory, bounded (keys, clients and spellings per key, submission IDs), seeded with a fake history at startup and reset on restart. Exact limits, eviction and normalisation rules are in `docs/planning/PLAN.md`. A real build would use a persistent store and an analytics pipeline.
- Insights expose what users search. Here they're behind a feature flag and labelled development-only; a real build puts them behind admin auth. The distinct-client threshold reduces noise but isn't anonymisation.
