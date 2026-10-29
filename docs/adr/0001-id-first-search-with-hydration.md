# ID-first search with hydration

Search returns *which* instruments match, in order, as IDs; a separate client-side store holds *what* each instrument is. We add two endpoints to the mock API for this (`POST /search/index` returning count, all facets, an ordered window of up to 1,000 IDs and the first batch of documents inlined; `POST /instruments/batch` for documents by ID), and the frontend keeps a `Map<id, Instrument>` so a document is fetched once per session and only missing IDs are ever requested.

## Why

Instrument data is static, so there is no reason to download the same document twice, and the frontend should only load what is about to be shown. The stronger reasons are where the product goes next: live prices become a separate layer keyed by the IDs on screen, updating every view of an instrument from one place; more markets slot in because IDs are already market-qualified (`VAS:AU`), with `/instruments/batch` as the single place that fans out to per-market data. Inlining the first batch keeps first paint to one round trip.

The frontend never filters, sorts or counts. The server computes order, `count` and every facet count over the full match set, so counts are correct at any scale regardless of what the browser holds. Filters and sort are refinements: each produces a new search state and a new ordered ID list; documents already in the store render immediately. Static data means every search state's response is cached for the session.

## Considered options

- **Server pages full documents, client caches each response.** Simplest, smallest per-change payload. Rejected because documents are copied into every cached response, which makes live prices stale on arrival and gives no single place to update an instrument.
- **Fetch the full match set per term, filter and sort in the browser.** Rejected: payload grows with match count, an empty query downloads the whole catalogue, and the client would re-implement the API's ranking, sorting and facets.
- **Compute facet counts in the browser from per-ID attributes.** Rejected: only correct if the browser holds every match, which breaks once IDs are windowed.

## Consequences

- The mock API gains two additive endpoints; existing endpoints are unchanged.
- Documents are small today (~400 bytes), so byte savings are modest; the case rests on live prices, more markets and scale.
- Past one window of matches (the API allows up to 1,000; the client asks for 500, `idLimit`) the client fetches the next ID window only (no facets or documents). With live data, windows would need a snapshot token so results don't shift between windows. _Changed 2026-10-29 (Israel, docs synced to the code): the snapshot token exists already. Every response carries `indexed_at`, and every later window and batch request sends it back as `snapshot`._
- A stale snapshot returns `409` with the current `indexed_at`, and the client drops its caches and reloads the first batch. _Added 2026-10-29 (Israel, docs synced to the code): why 409. It is a data-consistency choice, not a security one. The request is valid, so 400 would wrongly call it malformed. It is only stale, because it names a snapshot the server no longer holds, and 409 Conflict means a conflict with the current state of the resource. It also tells the client how to recover, using the current `indexed_at` in the response. 410 Gone implies the data was removed for good, when here it was replaced. 412 Precondition Failed is the standard code when the version check uses conditional headers (`If-Match` with an ETag). The snapshot travels in the JSON body, so 409 fits better, and if the token moved into a header, 412 would be the stricter choice._
- Ticking filters needs a server round trip for counts (counts-only, debounced), because AND combinations across facets can only be computed server-side. _Superseded 2026-10-30 (Israel): the filter debounce (150 ms, `countsDebounceMs`) was removed; filter ticks now take effect at once and the earlier request is cancelled, because the delay slowed every tick for almost no benefit._
- Price sort, when it exists, is a server snapshot: prices tick in place and the order refreshes only on a sort change or reload.
