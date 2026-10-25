# Plan Review Log: Betashares instrument search POC
Act 1 (grill-with-docs) complete — plan locked with the user. MAX_ROUNDS=4.
Round 1 runs two independent Codex reviews (A: lensed; B: fresh session); rounds 2+ continue with session A.

## Round 1 — Codex A (lensed; thread 01a17248-b0e7-76f1-b6ba-01c20aa98521)

## 1. CONTRARIAN — failure modes

1. **Search submissions and caching contradict each other.** The plan says repeated search states come from a session cache, but `/search/index` logs only when an HTTP request occurs. Repeating the same popular/recent/typed search may therefore never reach the server, while automatic query retries could log it multiple times.  
   **Fix:** Separate explicit search logging from cacheable index retrieval, or require a unique submission ID and idempotently log every user submission.

2. **The ID-window design has no snapshot consistency.** Successive `offset` windows can duplicate or skip records if the backing catalogue changes between requests; the plan acknowledges this only for future live data despite `indexed_at` already representing mutable source state.  
   **Fix:** Return `indexed_at` as a snapshot/version token and require it on subsequent windows, rejecting or restarting when it changes.

3. **Inclusive range buckets overlap.** Existing range filtering includes both `min` and `max` ([search.service.ts](../../api/src/services/search.service.ts#L102)), while facet buckets share adjacent edges ([search-fields.config.ts](../../api/src/models/search-fields.config.ts#L48)); an instrument exactly at 100,000,000 belongs to two buckets.  
   **Fix:** Define non-overlapping integer bounds explicitly, such as `0–99,999,999` and `100,000,000–499,999,999`, and test boundary values.

4. **Zero-count disabling can trap selected filters.** If live facet counts make a currently selected option zero and the checkbox is disabled, the user may be unable to untick the option that caused the dead end.  
   **Fix:** Never disable a selected option; zero-count unselected options may be disabled, while selected ones must remain removable.

5. **The dedupe algorithm is internally inconsistent about `OR`.** It says lowercase first but “keep `OR`”; after lowercasing, operator `OR` is indistinguishable from the ordinary word “or.” Existing search parsing recognizes only uppercase, whitespace-delimited `OR` ([search.service.ts](../../api/src/services/search.service.ts#L134)).  
   **Fix:** Specify tokenization before normalization and preserve an explicit operator token; add tests for `OR`, `or`, substrings, repeated operators, and leading/trailing operators.

6. **Blank and stopword-only searches can pollute the log.** Maximum term length is specified, but minimum/nonblank semantics are not; terms such as `" the asx "` normalize to an empty dedupe key. Initial catalogue loading could also be logged accidentally if it uses `intent: "search"`.  
   **Fix:** Define initial load as an unlogged refinement and reject logging for blank or empty-after-normalization terms.

7. **The anti-abuse model is easy to spoof.** Ranking by distinct client IDs is ineffective if the client supplies freely generated IDs; per-IP rate limiting is weak behind proxies and can also punish multiple users behind one NAT.  
   **Fix:** Define client-ID issuance, trusted-proxy handling, rate-limit keying, limits, response behavior, and an explicit statement that this is demo-only—not meaningful abuse resistance.

8. **Search-log eviction is underspecified and gameable.** “Least-used” does not define whether usage means events, distinct clients, recency, or dedupe groups; an attacker can fill the cap with tied one-off entries and evict legitimate history.  
   **Fix:** Specify a bounded per-key aggregate with deterministic LFU-plus-recency eviction and test tie-breaking and unique-term floods.

9. **Stale responses can overwrite newer pending-filter counts.** A 150 ms debounce does not prevent an older counts request from completing after a newer one and changing the button total/facets to the wrong state.  
   **Fix:** Key counts by the complete pending state and cancel or ignore responses whose request key no longer matches that state.

10. **External logo and font URLs are untrusted availability/privacy dependencies.** Missing-logo handling does not cover slow, broken, mixed-policy, or tracking-capable third-party image/font hosts.  
    **Fix:** Add image error fallback, restrictive referrer/CSP handling, and use a system/Inter fallback without the legally unverified font for the submitted POC.

## 2. FIRST-PRINCIPLES — problem framing and proportionality

1. **The plan optimizes for hypothetical scale rather than the actual challenge.** There are 834 static records, yet the design adds two endpoints, window continuation, hydration planning, a global document store, snapshot concerns, and multiple cache layers to avoid redownloading ~400-byte documents.  
   **Fix:** Use the existing paged `/search` endpoint for the MVP; present ID-first hydration as a documented production evolution, not a prerequisite.

2. **The backend effort is not “additive and minimal.”** Search indexing, batch hydration, logging, aggregation, eviction, rate limiting, CORS specialization, insights, seeding, and test refactoring are effectively a second product and dominate a frontend coding challenge.  
   **Fix:** Limit backend additions to the smallest missing acceptance-criterion capability—preferably one simple `/popular` or `/suggest` endpoint—and spend the saved effort on UI polish and end-to-end reliability.

3. **Popular searches are over-designed for fake in-memory data.** Distinct-client ranking, normalization, eviction, and abuse controls create production-looking complexity around seeded state that disappears on restart and has no real users.  
   **Fix:** Use a documented seeded popular-query fixture or small aggregate service, clearly labeled as mock behavior.

4. **Apply-on-button plus live server facet requests delivers much of the cost of live filtering without its simpler interaction.** Every tick still generates network work, but users also pay an extra click and must understand pending versus applied state on both rail and drawer.  
   **Fix:** For this dataset, live-apply filters with debounced/cancelled requests, or make apply-on-button truly deferred by updating no server counts until Apply.

5. **The settings and insights panel is demo theatre rather than user value.** It consumes substantial implementation and testing effort while core acceptance criteria have no E2E coverage.  
   **Fix:** Cut settings and insights until the required search, suggestions, filters, pagination, errors, accessibility, and responsive flow are complete and automated.

6. **“All seven facets” mistakes API capability for product requirement.** Raw boolean and range fields are not automatically useful filters, and the assignment asks for filtering—not exhaustive exposure of every backend field.  
   **Fix:** Ship the clearest high-value filters first—type, issuer, and perhaps Betashares/Auto Invest—and add others only with demonstrated UX value.

7. **React-only state weakens a search experience for cosmetic cleanliness.** Refresh loses the search; back/forward cannot restore refinements; reviewers cannot share a failing state.  
   **Fix:** Put committed term, filters, sort, and pagination state in URL parameters while keeping transient input and pending drawer edits local.

8. **No E2E test is the wrong tradeoff for the architecture chosen.** The riskiest behavior crosses debounce, cancellation, HTTP contracts, cache hydration, Apply state, and focus management—precisely what isolated unit/component tests may miss.  
   **Fix:** Replace several low-value extra-feature tests with one or two Playwright happy-path and stale-response regression flows.

## 3. EXECUTOR — buildability against this codebase

1. **`size` has two incompatible meanings.** In the current query model it is page size ([search-query.model.ts](../../api/src/models/search-query.model.ts#L27)); in `/search/index` it is the number of inlined documents, while `ids` independently needs up to 1,000 results. “Same body as `/search` plus” therefore cannot be implemented unambiguously by reusing `SearchService`.  
   **Fix:** Define separate `documentSize` and `idWindowSize`, or make the index response use `offset`/`limit` consistently and slice documents independently.

2. **`SearchService` exposes only already-paginated documents.** Its filter, ranking, ordering, and pagination operations are private, and `search()` paginates before returning ([search.service.ts](../../api/src/services/search.service.ts#L28)). The proposed service cannot obtain an arbitrary ordered ID window plus a differently sized document batch without abusing `size`, rerunning searches, or refactoring existing code.  
   **Fix:** Add an explicit internal `searchAll`/`buildResultSet` primitive returning the ordered full match set, then preserve the old `/search` behavior by paginating its output.

3. **The index response contract is incomplete.** The exact `facets` shape, `nextOffset` null/omission semantics, `indexed_at`, field-selection behavior, include-order/duplicates, and behavior when `documents` is requested without `ids` are all unstated.  
   **Fix:** Add request/response TypeScript types and complete JSON examples for full, counts-only, and continuation requests before implementation.

4. **Facet semantics for multi-select pending filters are unspecified.** Existing `FacetsService` replaces a facet’s entire selection with each single candidate value ([facets.service.ts](../../api/src/services/facets.service.ts#L103)); the UI needs a defined answer for whether counts mean “candidate alone,” “candidate added to selected OR values,” or total section matches.  
   **Fix:** Specify disjunctive facet-count semantics for selected and unselected options and write truth-table tests before wiring the UI.

5. **“Reuse `FacetsService`” can cause hundreds of full searches per request.** Each facet value invokes `SearchService.search`; issuer alone may produce many calls, multiplied across seven facets and every filter tick.  
   **Fix:** Compute the filtered base set once per index request and aggregate all facet counts in one pass, while leaving the legacy facet endpoint unchanged.

6. **Caching keys omit response-shaping settings.** The named search state contains term, applied filters, and sort, but `results per load` and ID-window size alter the response. Changing demo settings can retrieve an incompatible cached index result.  
   **Fix:** Include every response-shaping parameter and schema version in query keys, or keep server responses shape-independent and slice batches client-side.

7. **Batch endpoint edge behavior is undefined.** Duplicate IDs, case normalization, empty arrays, mixed valid/invalid IDs, maximum encoded length, and whether `missing` preserves requested order are left for the builder to guess.  
   **Fix:** Specify canonical case-insensitive lookup, duplicate policy, output ordering, empty-body behavior, and `missing` ordering with examples and tests.

8. **CORS requirements conflict with current global middleware.** The app currently allows every origin globally ([main.ts](../../api/src/main.ts#L71)); limiting only new endpoints requires route-aware policy, yet the roadmap says existing wiring should barely change. Custom client-ID headers would also require preflight configuration.  
   **Fix:** Define one app-wide development CORS policy or explicitly implement route-aware middleware including allowed methods and headers; do not call CORS a security boundary.

9. **Body-size enforcement has no specified threshold or placement.** The existing body parser is global ([main.ts](../../api/src/main.ts#L75)); endpoint-specific limits cannot be inferred from “body size.”  
   **Fix:** State the byte limit and whether it applies globally or only to new routes, then add an over-limit integration test.

10. **Validation policy conflicts with “existing behavior unchanged.”** Existing validation ignores unknown keys and accepts `from: 0`, which pagination silently treats as page 1 because of `from || DEFAULT_PAGE` ([search-query.validation.ts](../../api/src/validation/search-query.validation.ts#L26), [search.service.ts](../../api/src/services/search.service.ts#L196)). Reusing it for a stricter endpoint leaves unclear which quirks are retained.  
    **Fix:** Create endpoint-specific strict validation and explicitly characterize legacy quirks without copying them into the new contract.

11. **Sort stability is not contractual.** Equal explicit sort values return `0`, relying on JavaScript stable sort and the pre-existing ranked/default order; pagination needs a deterministic tie-breaker to prevent ambiguous page/window boundaries.  
    **Fix:** Add `symbol_openfigi` as an explicit final tie-breaker for every index sort.

12. **Failure semantics are missing for partial hydration.** The plan does not say what happens when batch hydration returns missing IDs, the batch call fails after IDs are cached, or a new search starts while “Load more” is resolving.  
    **Fix:** Define per-batch retry/error UI, stale-request guards, missing-record placeholders/removal, and atomic append behavior.

13. **“Static data → `staleTime: Infinity`” ignores API restarts and changing `indexed_at`.** A restarted API can serve a new catalogue while the browser holds old IDs/documents indefinitely.  
    **Fix:** Namespace document and search caches by `indexed_at`, and invalidate all related queries when it changes.

14. **Initial app/test refactoring is under-specified.** `main.ts` starts listening at module evaluation and catches startup failures itself, so Supertest needs a concrete `createApp()` boundary and dependency injection for repository/log/clock/client ID.  
    **Fix:** Specify `createApp(dependencies): Koa` plus a tiny executable bootstrap, with fresh in-memory dependencies per test.

## 4. OUTSIDER — likely hiring-panel questions

1. **“Why did the candidate rewrite the provided API instead of demonstrating frontend judgment?”** The brief explicitly says the API need not be changed, while most architectural novelty is backend infrastructure.  
   **Fix:** Lead with a working frontend against the supplied endpoints and isolate any optional backend enhancement behind a clearly removable adapter.

2. **“Why is hypothetical live-price architecture driving a POC with no price data?”** The justification for ID-first hydration depends heavily on features explicitly out of scope.  
   **Fix:** Present live-price compatibility as future work and choose the simplest contract that satisfies today’s requirements.

3. **“Why can’t I refresh or share a search?”** A clean URL may look like an omission rather than an intentional tradeoff to a reviewer testing normal browser behavior.  
   **Fix:** Persist committed search state in the URL or document and visibly demonstrate why it was intentionally excluded.

4. **“Are these really popular searches?”** Seeded, volatile in-memory history may look misleading if the interface presents it without qualification as cross-user popularity.  
   **Fix:** Label the data as demo-seeded in documentation and keep the production data-source design separate from the POC implementation.

5. **“Why is an unauthenticated user-facing gear exposing other users’ zero-result searches?”** Even with fake data, the design normalizes a privacy-sensitive admin function as part of the public search UI.  
   **Fix:** Remove insights from the public app or put it on a clearly mocked, development-only route and screen.

6. **“Why is a commercial-looking font loaded from an unverified third-party host?”** This signals licensing and privacy risk in a public submission.  
   **Fix:** Use Inter/system fonts for the submission unless Betashares supplies an authorized asset.

7. **“What is actually MVP?”** Many extras are embedded in the goal, architecture, demo, and core API contract even though the roadmap labels them optional; cutting them late may unravel dependencies.  
   **Fix:** Define a runnable vertical MVP milestone with only required capabilities and make every extra independently removable.

8. **“How do I verify the full system?”** A long manual walkthrough paired with no E2E suite makes the reviewer responsible for detecting integration regressions.  
   **Fix:** Provide one command that installs, starts, and tests both applications, including at least one browser-level acceptance flow.

## Top 5 most material issues

1. **The `/search/index` contract is not implementable cleanly as written:** `size` conflicts with existing pagination, and `SearchService` cannot return a full ordered result set plus a separate inline batch.
2. **Search logging is semantically broken by caching and retries:** genuine repeated submissions can be omitted, while a single submission can be double-counted.
3. **The solution is materially over-scoped for the challenge:** speculative ID hydration, analytics infrastructure, insights, settings, and abuse controls put core frontend delivery at risk.
4. **Facet behavior is not defined well enough to build correctly:** multi-select count semantics, overlapping ranges, and disabled selected options can all produce incorrect or unusable filtering.
5. **The cache/window model lacks consistency guarantees:** settings alter cached response shape, `staleTime: Infinity` ignores `indexed_at`, and continuation windows have no snapshot contract.

VERDICT: REVISE

## Round 1 — Codex B (independent; thread 01a1724a-62b9-7290-8f4e-8d53fa4f2214)

## Findings

1. **Critical — repeated searches are not logged.** The plan caches each search state for the session, but logging occurs only inside `/search/index`; submitting the same cached term/state again produces no request and therefore no popularity count.  
   **Fix:** Separate search-submission logging from result retrieval, or force every `intent:"search"` submission to reach the server while caching only refinements and hydration.

2. **Critical — `/search/index` has conflicting pagination semantics.** Existing `size` means page size and `from` means page number, while the proposed endpoint also uses `size` for inline documents and `offset` for ID windows, leaving service reuse and subsequent-window requests undefined.  
   **Fix:** Define a separate schema such as `id_offset`, `id_limit`, and `document_limit`, reject legacy `from`/`size`, and specify response invariants.

3. **High — the stated CORS restriction contradicts the current global middleware.** `cors()` runs globally before every route, so new endpoints will continue accepting every origin unless existing wiring changes; restricting only new routes also complicates preflight handling.  
   **Fix:** Replace global CORS with one explicit allow-list policy for the whole API, including OPTIONS behavior, and update the claim that existing wiring is untouched.

4. **High — zero-result insights misattribute filtered failures to search terms.** New searches retain applied filters, but the log records only term and result count; a valid term yielding zero under restrictive filters will be reported as a product gap.  
   **Fix:** Store canonical filters with each event and separate unfiltered term failures from filter-induced zero results.

5. **High — the search log remains memory-DoS-prone despite an entry cap.** A cap on dedupe keys does not bound per-key client IDs or spelling variants, and spoofable client IDs let one term accumulate unbounded sets.  
   **Fix:** Put hard limits on total events, clients and variants, expire entries, validate client IDs, and use bounded counters rather than unbounded sets.

6. **High — “distinct clients” is not a credible abuse control.** The anonymous client ID is unspecified and explicitly spoofable; per-IP logging limits reduce request rate but do not prevent rotating IDs or distributed poisoning.  
   **Fix:** Define server-issued signed client identifiers and enforce both per-IP and per-client quotas, while presenting popularity as POC-only data.

7. **High — insights expose arbitrary user-entered searches without authentication.** Rendering text safely prevents XSS but does not prevent disclosure of names, account details, or other sensitive text submitted as searches.  
   **Fix:** Remove the insights endpoint from the public UI or protect it with development-only/admin authorization and redact sensitive-looking values.

8. **High — normalization can collapse unrelated or empty searches.** Lowercasing, dropping stop words and sorting can map blank input, `the`, `ASX`, and similar terms to an empty key; the docs also conflict between a “word set” and merely sorted words.  
   **Fix:** Specify one canonicalization algorithm, trim first, deduplicate tokens if it is a set, and refuse to log empty normalized keys.

9. **High — validation requirements are incomplete relative to the existing permissive validator.** Current validation ignores unknown keys, accepts `from: 0`, accepts `size: 0`, permits arbitrary `order_by`, and has no request-size or text-length enforcement.  
   **Fix:** Give new endpoints strict schemas that reject unknown fields, bound all numeric values, whitelist sort fields/directions, and configure the body parser’s byte limit explicitly.

10. **Medium — `/search/index` response dependencies are unspecified.** It is unclear whether `documents` may be requested without `ids`, whether documents start at `offset`, how `nextOffset` behaves when IDs are omitted, or whether excluded fields are absent or empty.  
    **Fix:** Publish exact request/response types and define every `include` combination with contract tests.

11. **Medium — issuer suggestions do not implement the advertised term semantics.** `/facets/issuer` replaces the issuer filter and returns issuers attached to instruments matching the text; it is neither a query-log suggestion source nor necessarily a prefix match on issuer labels.  
    **Fix:** Add a small dedicated `/suggest` contract or explicitly fetch issuer values once and perform normalized label matching locally.

12. **Medium — request-race behavior is underspecified around pending refinements.** Debounced count responses can arrive after a search, drawer close, reset, or later filter edit and overwrite the currently displayed counts/button total.  
    **Fix:** Key count requests by a canonical pending-filter revision and ignore or abort every response whose revision is no longer current.

13. **Medium — cache identity is not defined canonically.** “Term + filters + sort” is insufficient when array order, casing, whitespace, absent versus empty filters, and range representation can produce different keys for the same server query.  
    **Fix:** Normalize the term and serialize sorted filter keys and values through one canonical request builder used by both transport and cache keys.

14. **Medium — load-more focus may create an inaccessible interaction.** Result rows are non-interactive, yet focus is moved to the first new row; without an intentional focus target and accessible label this can confuse keyboard and screen-reader users.  
    **Fix:** Give the first appended result a temporary `tabIndex="-1"`, programmatically focus it without scrolling unexpectedly, and test browse/focus-mode announcements.

15. **Medium — combobox accessibility coverage is too narrow.** “Keyboard flow” does not cover Escape, Tab, blur, Home/End, active-descendant lifecycle, grouped option labelling, loading, empty results, or dynamic suggestion announcements.  
    **Fix:** Specify the complete ARIA combobox interaction contract and test it with axe plus keyboard-focused component cases.

16. **Medium — the hotlinked font is a delivery, privacy, and licensing risk.** The plan knowingly relies on an unverified third-party font host, which may fail offline, track visitors, reject cross-origin loads, or expose the submission to licensing concerns.  
    **Fix:** Use the system/Inter fallback for the challenge unless a licensed, reliable font source is confirmed.

17. **Medium — observability does not cover the risky backend additions.** Console analytics provides no visibility into request latency, validation failures, rate-limit decisions, log evictions, poisoning attempts, or endpoint errors.  
    **Fix:** Add structured development logs and counters for endpoint status/latency, rejected logs, rate limits, and evictions without recording raw search terms.

18. **Medium — there is no end-to-end contract test for the new architecture.** Separate API and component tests can both pass while request field names, CORS, response shapes, hydration order, or focus behavior are incompatible.  
    **Fix:** Add at least one automated browser smoke test covering search, suggestion selection, filter apply, load more, and API-down recovery.

19. **Medium — “static forever” caching conflicts with configurable and mutable behavior.** `staleTime: Infinity` can preserve old popular data, old search windows, or documents after API restart/data changes, despite `indexed_at` already existing.  
    **Fix:** Namespace caches by `indexed_at`, invalidate affected queries after configuration changes, and give aggregate endpoints finite freshness.

20. **Medium — units buckets overlap at their inclusive boundaries.** Existing facet buckets are emitted as adjacent `min,max` ranges while range comparison is inclusive on both ends, so boundary values belong to two buckets.  
    **Fix:** Define half-open buckets or adjust adjacent bounds so each numeric value belongs to exactly one option.

21. **Medium — the plan spends most risk budget outside the assignment.** ID hydration, search logging, insights, settings, raw-data display, seven aggregated facets, and branch-per-workstream delivery create substantial failure surface for a frontend challenge whose existing API already supports results, filters, sorting, and paging.  
    **Fix:** Implement the acceptance criteria against `/search` and `/facets` first, then add only a minimal popular-search endpoint if time and tests remain.

## Top 5 most material issues

1. Cached repeat searches bypass the server-side log, breaking the central popularity model.
2. `/search/index` overloads pagination fields and lacks an implementable, unambiguous schema.
3. Filtered zero results are incorrectly reported as term/product gaps.
4. The in-memory log is still vulnerable to unbounded client/variant growth and spoofed popularity.
5. Scope is disproportionate to the assignment and lacks an end-to-end test protecting the expanded contract.

VERDICT: REVISE

### Claude's response (round 1)

Both reviews converged on the real defects; PLAN.md rewritten. Verified one claim against the data: no instrument's `units_circulating` sits on a bucket edge today.

**Accepted**
- Cached repeat searches skip the log (A1, B1): search submissions always hit the network with a `submission_id`; logging is idempotent on it, so retries can't double-count. Refinements, hydration, counts and initial load use the cache.
- `size`/`from`/`offset` overloading (A-Ex1, B2): new schema `id_offset`, `id_limit`, `document_limit`; full TypeScript request/response contract added, including every `include` combination and 400/409 cases (A-Ex3, B10).
- `SearchService` can't return a full ordered set (A-Ex2): add internal `searchAll`; legacy `search()` becomes `paginate(searchAll())`, pinned by baseline tests.
- Facet cost (A-Ex5): one base pass plus one pass per active facet, aggregated; not one search per value.
- Disjunctive count semantics (A-Ex4): specified to match existing `FacetsService`; truth-table tests.
- Filtered zero results misattributed (B4): log `unfiltered_count`; insights and popular use it.
- Log memory bounds and eviction (A-C8, B5): caps on keys, saturating client counts, spellings per key; eviction rule defined.
- Abuse model honesty (A-C7, B6): client ID defined (UUID header, validated), per-IP + per-client token buckets, explicitly documented as demo-grade.
- Insights privacy (B7, A-Out5): only keys with ≥ 2 distinct clients shown; behind `ENABLE_INSIGHTS`; admin-only in production noted.
- Dedupe `OR` / empty keys (A-C5, A-C6, B8): tokenise first, operator token preserved, token set, empty keys never logged; initial load is an unlogged refinement.
- Strict validation (A-Ex10, B9), explicit 32KB body limit (A-Ex9).
- CORS contradiction (A-Ex8, B3): dropped the per-route CORS claim; keep existing global policy, state CORS isn't a security boundary, allow `X-Client-Id` in preflight.
- Stale counts overwrite (A-C9, B12) and canonical cache keys (B13): one `buildSearchRequest` drives body and key; superseded responses discarded.
- Cache shape / `indexed_at` (A-Ex6, A-Ex13, B19): keys include `indexed_at` and response-shaping values; a changed `indexed_at` clears caches.
- Snapshot consistency across windows (A-C2): `snapshot` token, 409 on change, client restarts.
- Selected zero-count options trapped (A-C4): selected options never disabled.
- Deterministic tie-breaker (A-Ex11): `symbol_openfigi`.
- Partial hydration failure (A-Ex12): atomic append, missing IDs skipped and logged, inline retry, cancellation on new search.
- `createApp(deps)` boundary (A-Ex14).
- Load-more focus (B14): `tabIndex={-1}` + `preventScroll`.
- Combobox contract (B15): full keyboard/ARIA contract specified, `jest-axe`.
- Issuer suggestions semantics (B11): fetch issuer values once, match labels locally.
- Logo robustness (A-C10): `onError` fallback, `referrerPolicy="no-referrer"`.
- Observability (B17): structured dev logs for rejects, rate-limit drops, evictions; no raw terms.
- Popular labelled as demo data (A-Out4).
- MVP clarity (A-Out7, B21 partly): M1 vertical slice vs M2 removable extras.
- One command (A-Out8): root `setup`, `dev`, `test`.

**Documented rather than changed**
- Overlapping inclusive unit buckets (A-C3, B20): existing API behaviour; frontend uses edges as given (Israel's "display data as given" rule); recorded as a backend finding; test asserts no instrument sits on an edge.

**Rejected (user decisions, kept)**
- Use legacy `/search` for MVP / ID-first as future work (A-FP1, A-FP2, A-Out1, A-Out2, B21): the ID-first contract is the candidate's deliberate showcase of backend-contract influence; risk handled by M1/M2 and baseline tests.
- Simplify popular to a fixture (A-FP3): the user wants the real loop (log → popular/insights); hardened instead.
- Live-apply filters or no live counts (A-FP4): user chose apply-on-button with live counts to limit result fetches.
- Cut settings/insights (A-FP5): kept, moved to M2.
- Fewer filters (A-FP6): user chose all 7.
- URL state (A-FP7, A-Out3): user chose React state; rationale to be shown in the walkthrough.

**Escalated to Israel (both reviewers agree; reversing a user decision)**
- E2E smoke test (A-FP8, A-Out8, B18).
- Hotlinked Rund Text (A-C10, A-Out6, B16).

### Israel's decisions on round 1 escalations
- Logging: keep the browser cache for repeat searches. Resolved by a separate `POST /searches` log endpoint (server computes counts); `/search/index` is pure and cacheable. ADR 0002 updated.
- E2E: tests must run without AI or browser tooling on the reviewer's machine. Playwright explored, rejected as bloat (browser downloads for one flow); the specific cross-boundary risks are covered in `npm test` (in-process contract tests, supertest CORS preflight, jsdom focus/live-region). Visual layout stays manual.
- Font: keep hotlinked Rund Text (non-commercial POC; Betashares uses it). Residual licence/availability risk documented; Inter fallback; files never committed.

## Round 2 — Codex A (resumed)

## 1. CONTRARIAN — failure modes

1. **Idempotency reintroduces an unbounded-memory attack.** The plan bounds keys, client sets, and spellings, but idempotency requires retaining every `submission_id`; that registry has no cap or expiry ([PLAN.md:21](../../docs/planning/PLAN.md#L21)).  
   **Fix:** Define a bounded global submission-ID registry with TTL and deterministic eviction, and test expiry, eviction, and replay behavior.

2. **The dedupe key is not result-equivalent, so memoised counts can be wrong.** Dropping `and/the/of/for/asx` changes the current search text, because `SearchService` does not ignore stopwords; two spellings assigned the same key can therefore have different result counts. Memoising `unfiltered_count` “per key” lets the first spelling dictate whether every variant is popular or zero-result.  
   **Fix:** Either stop removing search-significant words or cache counts by canonical executable query/spelling and define how mixed-result variants aggregate.

3. **`OR` normalization still collapses semantically different expressions.** Tokens are sorted, so operator position is lost: structurally different searches can produce the same key even though the existing API splits on uppercase ` OR ` and evaluates alternatives independently.  
   **Fix:** Preserve ordered OR clauses, canonicalizing words only within each clause, and exclude malformed operator placement from logging.

4. **Rate-limited idempotency behavior is ambiguous.** `/searches` returns `202` when dropped, but it is unspecified whether the rejected `submission_id` becomes consumed; a retry using the same ID could either remain dropped or later become logged.  
   **Fix:** State that rate-limited IDs are either recorded as permanently consumed or not recorded at all, and test the selected behavior.

5. **The UUID header contract is unclear when missing.** Popularity requires a client identity, but `/searches` does not explicitly say whether `X-Client-Id` is mandatory or what response missing/invalid values receive ([PLAN.md:71](../../docs/planning/PLAN.md#L71)).  
   **Fix:** Make `X-Client-Id` required for `/searches`, specify the error response, and distinguish validation failures from silent rate-limit drops.

6. **Cache invalidation still cannot reliably discover a restarted API.** Including `indexed_at` in cache keys works only after a response reveals the new value; a repeated search served forever from `staleTime: Infinity` makes no request and can retain the old catalogue indefinitely ([PLAN.md:26](../../docs/planning/PLAN.md#L26)).  
   **Fix:** Fetch a lightweight version/health token on startup and API reconnection, or give the catalogue-version query finite freshness and invalidate index/document caches when it changes.

## 2. FIRST-PRINCIPLES — whether the accepted fixes solve the original problems

1. **Separating logging from retrieval successfully resolves cached repeat submissions.** A fresh submission ID per user action with stable reuse across retries is the correct division between a mutation and cacheable search retrieval.  
   **Fix:** Preserve this design, but complete its bounded idempotency contract.

2. **The new index pagination model resolves the original `size` conflict.** `id_offset`, `id_limit`, and `document_limit` are distinct and `searchAll` supplies the missing internal seam.  
   **Fix:** Add the remaining response invariants: `document_limit > id_limit`, empty windows, and continuation requests that exclude `ids`.

3. **The snapshot token resolves window consistency in principle.** Returning `indexed_at`, requiring `snapshot` after the first window, and restarting on `409` forms a coherent continuation protocol.  
   **Fix:** Apply the same snapshot check to batch hydration, or require the client to compare the batch `indexed_at` before committing documents.

4. **The M1/M2 split is improved but “independently removable” is overstated.** M1 already contains the search log used by M2 insights, while the shared gear/header and configuration surfaces may cross milestone boundaries.  
   **Fix:** State that M2 UI is removable while shared M1 backend primitives remain, and identify the exact feature flags or module boundaries used to cut M2.

5. **Documenting the overlapping buckets is acceptable under the settled data-as-given decision, but the UI must not imply exclusivity.** A “single-select bucket” suggests mutually exclusive ranges even though the backend ranges overlap.  
   **Fix:** Document the inclusive labels precisely and keep the asserted no-edge-data invariant in both fixture and contract tests.

## 3. EXECUTOR — buildability against this codebase

1. **Facet aggregation does not say how zero-count values remain present.** Aggregating only the result passes yields values that occur in those passes; the UI requires all possible options, including zero-count ones ([PLAN.md:19](../../docs/planning/PLAN.md#L19), [PLAN.md:32](../../docs/planning/PLAN.md#L32)).  
   **Fix:** Initialize each facet from the repository-wide value universe/bucket configuration, then overlay aggregated counts and emit explicit zeros.

2. **The `include` invariants remain incomplete despite the claim that every combination is defined.** `documents` requires `ids`, but the contract does not define whether `id_offset`, `id_limit`, and `document_limit` are honored or rejected when their associated fields are excluded.  
   **Fix:** Add a small include-combination table specifying ignored versus rejected pagination fields and the exact properties returned.

3. **`document_limit > id_limit` is unspecified.** “First N of this ID window” implies clamping, but strict validation might instead reject it; builders and tests could choose differently.  
   **Fix:** Specify either `documents.length ≤ min(document_limit, ids.length)` or require `document_limit ≤ id_limit`.

4. **Batch hydration lacks a request-side snapshot.** Comparing the returned `indexed_at` after downloading prevents committing stale documents, but the server still performs work and the response contract does not explicitly require the client to reject the batch atomically.  
   **Fix:** Add optional/required `snapshot` to `BatchRequest` with the same `409` behavior, or explicitly mandate pre-commit version comparison and restart.

5. **“Exact match” conflicts with the existing case-insensitive instrument lookup.** The batch contract demands uppercase format and exact matching, while `getById` currently ignores case ([search.service.ts:47](../../api/src/services/search.service.ts#L47)). Reusing the service silently violates the new contract.  
   **Fix:** State that batch validation canonicalizes uppercase before the existing lookup, or implement a separate exact repository lookup and test lowercase rejection.

6. **The full-set refactor needs a precise ordering invariant.** “Deterministic tie-breaker on every order” must be appended after the existing ranking/default comparators; replacing stable ties directly with ID order could alter legacy results despite otherwise identical filtering.  
   **Fix:** Specify comparator order for default, text-ranked, and explicit sorts, with `symbol_openfigi` only as the final comparator.

7. **The root `dev` command conflicts with the dependency restriction unless implemented carefully.** Running two persistent processes portably usually needs a process runner, but the plan permits no new dependency for it.  
   **Fix:** Specify a small Node orchestration script using built-in `child_process`, including signal forwarding and cleanup, or permit one dev-only process-runner dependency.

8. **The contract integration-test location is unclear.** A frontend suite importing `createApp` from the API crosses separate TypeScript configs, package roots, dependency trees, and potentially module formats.  
   **Fix:** Define the integration-test package/location, dependency ownership, API fixture path, and how `npm test` builds or transpiles both projects.

9. **Snapshot invalidation during load-more needs a visible state transition.** “Restart on 409” does not say whether already rendered rows disappear, whether focus remains on Load more, or whether the user receives an announcement.  
   **Fix:** Define restart as an atomic first-page reload with an accessible “Results were refreshed” announcement and stable focus.

## 4. OUTSIDER — what the hiring panel may question

1. **ADR 0002 is now stale relative to the binding plan.** It still says “least-used eviction,” only mentions per-IP rate limiting, and omits the bounded clients/spellings, per-client rate limit, insights threshold, feature flag, and exact normalization rules ([ADR 0002:15](../../docs/adr/0002-server-side-search-log.md#L15)).  
   **Fix:** Update the ADR consequences to match the concrete PLAN contract or explicitly defer to PLAN.md for those mechanics.

2. **“Fire-and-forget” may be misread as unreliable logging.** Reviewers may reasonably ask whether navigation, component unmounting, or aborted requests loses submitted searches.  
   **Fix:** Say the UI does not block result rendering on the logging response, but does initiate a normal non-cancelled request and reports failures only to development logs.

3. **“Seeded: true” is misleading after live searches are added.** The response contains both seed and live aggregates, so a single boolean can imply that every displayed term is fake.  
   **Fix:** Rename it to `includes_seed_data` or attach provenance per term if the UI needs to distinguish them.

4. **The insights safeguard can still be mistaken for privacy protection.** Two spoofable client IDs do not prevent arbitrary personal text from appearing, although the plan correctly labels the endpoint demo/admin-only.  
   **Fix:** Make the development-only nature visually explicit in the Insights panel and avoid claiming that the threshold meaningfully anonymizes data.

5. **The revised plan is much more precise, but it now resembles an implementation specification more than a hiring-challenge plan.** That is a settled scope choice, yet inconsistencies between the plan, ADR, roadmap, and walkthrough will be especially visible.  
   **Fix:** Before implementation, reconcile all supporting docs with the binding endpoint names and logging semantics, removing the old `intent`-based model everywhere.

## Top 5 most material issues

1. The idempotency registry is unbounded, reopening the memory-exhaustion flaw the revision claims to have fixed.
2. Per-key memoised `unfiltered_count` is unsound because the dedupe algorithm can merge terms with different search results.
3. Infinite client caching still has no reliable mechanism to discover an API restart or new `indexed_at`.
4. Facet aggregation does not guarantee emission of the zero-count options required by the UI.
5. ADR 0002 and likely other supporting docs still describe the superseded logging model and security bounds.

VERDICT: REVISE

### Claude's response (round 2)

**Accepted** (all but noted): bounded submission registry with TTL; rate-limited IDs not recorded; `X-Client-Id` required on `/searches` (400 if missing); `unfiltered_count` memoised per executable spelling, popular uses the label spelling, insights requires every spelling zero; `OR` handled as ordered clauses with malformed operators not logged; `GET /version` for restart discovery; snapshot on batch hydration; atomic 409 restart with announcement and focus; facet value universe so zeros are emitted; include-combination rules and `documents.length = min(...)`; case canonicalisation consistent with existing lookup; tie-breaker appended only in the index path; `dev` via a built-in `child_process` script; contract tests in `web/tests/contract/` start the API as a child process (no cross-imports, no new deps); `includes_seed_data` rename; ADR 0002 and roadmap reconciled; insights wording no longer implies anonymisation; M2 removability stated precisely.

**Documented, not changed:** overlapping inclusive unit buckets stay as given (settled data-as-given rule); fixture/contract test asserts no instrument on an edge.

## Round 3 — Codex A (resumed)

## 1. CONTRARIAN — failure modes

1. **The per-key spelling cap can corrupt popular/zero-result classification.** Only 10 spellings are retained, but classification now depends on per-spelling `unfiltered_count`; the plan does not say which spelling is discarded or whether a discarded positive-result spelling remains represented ([PLAN.md:21](../../docs/planning/PLAN.md#L21)).  
   **Fix:** Define deterministic spelling eviction and retain bounded key-level flags/counters such as `has_positive_result`, so discarded variants cannot turn a mixed key into a false zero-result insight.

2. **Idempotency is now bounded, but only within a 10-minute window.** Calling `/searches` simply “idempotent” overstates the guarantee because a delayed replay after TTL can be counted twice.  
   **Fix:** Describe it as “idempotent within the 10-minute retry window” in the plan, ADR, and roadmap.

3. **A non-cancelled logging request can outlive stale UI submissions.** If the user submits A and immediately submits B, both are intentionally logged; that is defensible, but “search submission” needs to mean the explicit user action rather than the search whose results remain displayed.  
   **Fix:** State explicitly that every explicit submission is logged even when superseded before its result renders, and test this behavior.

## 2. FIRST-PRINCIPLES — whether round-2 fixes worked

1. **The main round-2 logging defects are resolved.** Submission IDs are bounded, rate-limited IDs have defined behavior, client identity is required, and counts are cached per executable spelling rather than incorrectly per dedupe key.  
   **Fix:** Complete the spelling-overflow rule above; otherwise preserve this design.

2. **The revised OR normalization is now semantically coherent.** Clause boundaries are retained, malformed operators are rejected, and sorting clauses is valid because OR is commutative under the existing search implementation.  
   **Fix:** Add tests proving reordered clauses produce the same key while differently grouped words do not.

3. **Restart and snapshot handling is now credible.** `/version`, request-side batch snapshots, `409` restart behavior, focus movement, and announcements close the earlier stale-window gap.  
   **Fix:** Specify the `/version` query’s concrete `staleTime`/refetch interval rather than only “finite freshness.”

4. **Facet and include contracts are substantially fixed.** Repository-wide value initialization preserves zeros; clamping, empty windows, excluded-ID behavior, and batch snapshot semantics are now stated.  
   **Fix:** Mirror these exact rules in the roadmap, which currently restores the old ambiguity.

5. **The M1/M2 boundary is now honest enough.** It correctly distinguishes removable M2 UI from the M1 search-log primitive.  
   **Fix:** Update the roadmap headings or milestone annotations so builders can see that boundary outside PLAN.md.

## 3. EXECUTOR — buildability against this codebase

1. **The roadmap still specifies the rejected, unbuildable index contract.** It says “same body as `/search`,” uses `offset`, overloads `size`, returns `nextOffset`, and omits snapshots ([roadmap.md:18](../../docs/roadmap.md#L18)); PLAN.md instead defines `id_offset`, `id_limit`, `document_limit`, `next_id_offset`, and `snapshot`.  
   **Fix:** Replace the roadmap endpoint summary with the exact PLAN contract or link to it without restating fields.

2. **The roadmap batch contract omits its required snapshot.** It still documents `{ ids }` only ([roadmap.md:23](../../docs/roadmap.md#L23)), contradicting the required `{ ids, snapshot }` request in PLAN.md.  
   **Fix:** Add the required snapshot, `409` semantics, canonicalization, duplicate handling, and bounds.

3. **The roadmap reintroduces the CORS contradiction.** It claims new endpoints are limited to `localhost:3000` ([roadmap.md:28](../../docs/roadmap.md#L28)), while the binding plan deliberately retains global permissive `cors()`.  
   **Fix:** Replace that item with the agreed global development CORS policy and `X-Client-Id` preflight coverage.

4. **The roadmap still contains the obsolete dedupe algorithm.** It says lowercase everything, retain `OR`, and sort all words ([roadmap.md:27](../../docs/roadmap.md#L27)); this loses the clause-aware behavior added to PLAN.md.  
   **Fix:** Summarize the clause-preserving algorithm accurately or refer directly to `dedupeKey()` in PLAN.md.

5. **The roadmap still promises reuse of `FacetsService`.** The new plan requires repository-universe initialization and aggregate passes, which is not what the current per-value `FacetsService` does.  
   **Fix:** Say the new index service reuses shared search/filter primitives while legacy `FacetsService` remains unchanged.

6. **The roadmap’s scripts and testing strategy remain stale.** It lists only `web:install`/`web`, old component coverage, and manual-only integration, omitting `setup`, `dev`, root `test`, `/version`, contract tests, stale-response tests, snapshots, and 409 behavior.  
   **Fix:** Reconcile the foundation and quality sections with PLAN steps 10 and 18.

7. **The roadmap says windowed snapshots are out of scope even though they are now required.** This directly contradicts the implemented snapshot protocol ([roadmap.md:129](../../docs/roadmap.md#L129)).  
   **Fix:** Remove that out-of-scope item or narrow it to live-price/search-index snapshots beyond the catalogue `indexed_at` protocol.

## 4. OUTSIDER — likely panel confusion

1. **Two authoritative-looking documents now describe different APIs.** Although PLAN.md says it is the contract, the roadmap presents concrete implementation checkboxes that a reviewer will reasonably treat as current.  
   **Fix:** Make roadmap entries consistent and add “Exact contract: PLAN.md” beside endpoint summaries.

2. **ADR 0002 is materially reconciled but contains awkward nested punctuation.** “endpoint (non-blocking (results never wait…” reads like an unfinished edit ([ADR 0002:3](../../docs/adr/0002-server-side-search-log.md#L3)).  
   **Fix:** Rewrite as: “The browser sends a normal, non-blocking request; result rendering never waits for it, and failures only reach development logs.”

3. **ADR 0002 does not explain mixed-result spellings.** This is now central because dedupe groups can contain executable spellings with different counts, yet the ADR still says simply that only terms with results qualify.  
   **Fix:** Add one sentence explaining that counts are computed per executable spelling, popular uses a positive label spelling, and insights require every retained spelling to have zero results.

4. **The roadmap’s stale CORS claim could create a false security claim in the final submission.** A panel member comparing it with `cors()` will see a discrepancy immediately.  
   **Fix:** Remove every allow-list claim consistently before implementation.

## Top 5 most material issues

1. The roadmap still contains the original conflicting `/search/index` pagination contract.
2. The roadmap omits required snapshot semantics for batch and window retrieval.
3. The roadmap contradicts the settled global CORS policy.
4. The bounded spelling store lacks rules preserving correct popular/zero-result classification after spelling eviction.
5. The roadmap retains obsolete dedupe, test, script, and out-of-scope statements, undermining the otherwise implementable PLAN.md.

The binding plan itself is now close to implementable, and most round-2 defects were genuinely resolved. The remaining blocker is that the supposedly updated roadmap still directs a builder toward incompatible endpoint and security behavior.

VERDICT: REVISE

### Claude's response (round 3)

**Accepted, all:** spelling eviction rule plus key-level `has_positive_result` (insights now keyed on it); idempotency described as "within a 10-minute retry window" everywhere; explicit submissions logged even when superseded, with a test; `/version` stale time set to 60s; `OR`-clause tests; roadmap rewritten to match PLAN (index/batch contracts summarised with links to the exact contract, `/version`, `/searches`, clause-aware dedupe, global CORS policy, `searchAll` + unchanged `FacetsService`, root scripts, cache keys, test strategy, narrowed out-of-scope snapshot item, M1/M2 annotation); ADR 0002 punctuation fixed and mixed-spelling rule explained.

## Round 4 — Codex A (resumed, final round)

## 1. CONTRARIAN

1. **The walkthrough still makes the opposite CORS/security decision.** It says new endpoints are restricted to `localhost:3000` and lists “Any origin” as rejected ([walkthrough.md:295](../../docs/walkthrough.md#L295)), while PLAN and roadmap retain global permissive CORS. This can produce either the wrong implementation or a false security claim.  
   **Fix:** Update the walkthrough row to the agreed global development CORS policy and state that rate limiting—not CORS—is the demo abuse control.

## 2. FIRST-PRINCIPLES

The round-3 material issues are otherwise resolved:

- The spelling cap now has deterministic eviction and key-level positive-result state.
- Idempotency is correctly scoped to a bounded retry window.
- Superseded explicit submissions are defined and tested.
- `/version` has concrete freshness behavior.
- Snapshot, facet-zero, include, batch, testing, and M1/M2 contracts are coherent.

One remaining ambiguity:

1. **Popular-label selection differs subtly between PLAN and ADR.** PLAN says the label is the most frequent spelling and admits a key only when that label has results ([PLAN.md:22](../../docs/planning/PLAN.md#L22)); ADR says popular “uses a label spelling that returns results” ([ADR 0002:7](../../docs/adr/0002-server-side-search-log.md#L7)). For a mixed key whose most frequent spelling has zero results, these imply exclusion versus selecting another positive spelling.  
   **Fix:** Define the label as the most frequent positive-result spelling, or explicitly state that such mixed keys are excluded.

## 3. EXECUTOR

1. **The roadmap still contradicts itself about `FacetsService`.** Its introduction says new behavior reuses `SearchService` and `FacetsService` ([roadmap.md:15](../../docs/roadmap.md#L15)), while the concrete task correctly says the new index service performs aggregation and legacy `FacetsService` remains unchanged ([roadmap.md:20](../../docs/roadmap.md#L20)). Following the former recreates the expensive per-value search implementation the plan rejected.  
   **Fix:** Change the introduction to say the index service reuses shared search/filter primitives while legacy `FacetsService` remains untouched.

2. **The endpoint, snapshot, cache, script, and test contracts are now buildable.** The previous conflicting `offset`/`size`, missing batch snapshot, stale CORS roadmap entry, obsolete dedupe summary, and snapshot out-of-scope statement have been corrected.

## 4. OUTSIDER

1. **The remaining CORS contradiction is panel-visible and security-sensitive.** A reviewer reading the walkthrough’s decision table will believe the API has an origin allowlist, then find unrestricted `cors()` in the implementation.  
   **Fix:** Reconcile the walkthrough before implementation or delivery.

2. **ADR 0002 has a minor typo, not a material design flaw.** “the server” begins lowercase after a period ([ADR 0002:3](../../docs/adr/0002-server-side-search-log.md#L3)).  
   **Fix:** Capitalize it during normal editorial cleanup.

## Material ranking

1. Walkthrough still instructs and claims the opposite CORS policy.
2. Popular-label behavior for mixed-result spellings remains ambiguous.
3. Roadmap introduction still suggests reusing the unsuitable legacy `FacetsService`.

The core plan is now feasible, but the unresolved CORS contradiction can directly produce a wrong implementation and false security documentation.

VERDICT: REVISE

### Claude's response (round 4) and resolution

All three remaining points fixed after the final round: walkthrough CORS row now matches the global development policy (rate limits are the abuse control); popular label defined as the most frequent spelling that returns results, in PLAN and ADR 0002; roadmap intro no longer suggests reusing `FacetsService`. ADR typo fixed.

**Outcome:** MAX_ROUNDS (4) reached with VERDICT: REVISE on round 4, but Codex's round-4 findings were documentation inconsistencies only ("the core plan is now feasible"), all resolved above. Not formally APPROVED; no design disagreement remains open. Presented to Israel for sign-off.

## Round 5 — confirmation round (user override past MAX_ROUNDS)

## 1. CONTRARIAN

No material security, race, cache, or logging defect remains in the reviewed documents. The bounded logging structures, snapshot protocol, stale-response handling, and restart discovery are sufficiently specified.

## 2. FIRST-PRINCIPLES

The M3 theming phase does not undermine M1:

- M1 remains functional and accessible on Chakra’s default theme.
- Components are constrained to semantic styling interfaces.
- Brand styling is isolated to configuration and visual verification.
- M3 can be omitted without breaking the acceptance-criteria implementation.

## 3. EXECUTOR

The previous contradictions are resolved:

- PLAN and ADR select the most frequent positive-result spelling for popular labels.
- Roadmap correctly leaves legacy `FacetsService` unchanged.
- Walkthrough now matches the global development CORS policy.
- Index, batch, snapshot, cache, logging, testing, and milestone contracts are mutually consistent.

The theme can be implemented through semantic tokens and Chakra recipes without changing component behavior.

## 4. OUTSIDER

A hiring-panel reviewer can now distinguish:

- M1: complete acceptance-criteria implementation.
- M2: removable demonstration extras.
- M3: brand theming applied after functionality is stable.

No reviewed inconsistency would materially misrepresent security or direct the implementation toward the wrong contract.

VERDICT: APPROVED

**Outcome: APPROVED in round 5 (confirmation round, user override). Plan locked for build.**
