# Demo runbook

Flows to walk through when presenting the POC. Each flow lists the steps, what should happen, and the point it proves. Brief criteria are tagged **[AC]**; extras beyond the brief are tagged **[Extra]**.

## Before you start

1. `npm run api` (mock API on `:8787`) and `npm run web` (app on `:3000`)
2. Open `http://localhost:3000` in a fresh profile or clear site data, so there are no recent searches
3. Open DevTools: Console (for `[analytics]` lines) and Network (filter `Fetch/XHR`)
4. Optional: Rotor / VoiceOver ready for the accessibility flow

---

## 1. First visit

1. Load the page.
   - Skeleton cards show, then results: Betashares instruments first, then A–Z
   - Top 10 popular search pills sit under the input
2. Focus the empty input.
   - No recent searches yet, so the popup shows only a short hint

**Proves:** loading states **[AC]**, popular terms surfaced without typing **[AC]**.

## 2. Popular search pill

1. Click a pill (e.g. `Gold`).
   - Input fills, results update, count shown
   - Console: `[analytics] search_submitted { source: "popular" … }`
2. Focus the empty input again.
   - `Gold` now appears under Recent searches

**Proves:** commonly searched terms guide users **[AC]**; a pill click counts as a search.

**Talking point:** popular terms come from the API's own search log (`GET /popular`), seeded with a fake history and updated live. The server dedupes them (`VGS vanguard` and `vanguard VGS` are one term, `VGS ASX` folds into `VGS`), ranks by distinct users rather than raw hits so one script can't flood the pills, and only terms with results qualify.

## 3. Suggestions while typing

1. Type `va`.
   - Nothing fires (Network stays quiet): suggestions start at 3 characters
2. Type `n` → `van`.
   - After a short pause, one request pair fires, not one per keystroke
   - Popup shows two groups: **Searches** (e.g. Vanguard, VanEck) and **Instruments** (top 5 with logos)
3. Type quickly: `vang`.
   - Earlier in-flight requests are cancelled (shown as cancelled in Network)
4. Arrow down through both groups, then Enter on a search term.
   - Term fills the input and the search runs: refining before completing the query
5. Type `a20`, pick the `A200` instrument.
   - Search runs for that ticker; A200 is the top result

**Proves:** real-time predictive suggestions **[AC]**, refine via suggested terms **[AC]**, debounce + minimum length + cancellation.

**Talking point:** suggestions come through a `SuggestionSource` seam. The mock adapter combines issuer facets and a lightweight `/search?fields=` call. A real build swaps in a `/suggest` endpoint backed by a query log, with no UI change.

## 4. Recent searches [Extra]

1. Search `bank`, then `gold`, then `BANK` again.
   - Recent shows `BANK` at the top, once (case-insensitive dedupe, re-search moves to top)
2. Remove one with ×.
3. Type `ba`.
   - Matching recent searches lead the list

**Proves:** quick repeat searches; saved on submit only, never per keystroke.

## 5. Results and pagination

1. Search `vanguard` (31 results).
   - Cards: logo, ticker, name, type badge, issuer, Betashares / Flagship / Auto Invest badges where they apply
2. Click **Load 15 more**.
   - Skeleton rows appear below the existing results, then fill in; the button doesn't change size
   - Focus lands on the first new row; a screen reader hears "15 more loaded, showing 30 of 31"
3. Click once more.
   - Last result appears, button is replaced by an end-of-results message

**Proves:** results below the bar **[AC]**, relevant info per result **[AC]**, pagination **[AC]**.

## 6. Filters: drill down

1. Clear the query. Tick **Type: ETFs**.
   - After a short pause the results update. While they load, the previous results stay on screen, dimmed
   - Every other filter's counts update
2. Tick **Issuer: Vanguard** and **BlackRock** quickly.
   - One results request, not two (debounced)
3. Toggle **Available for Auto Invest**.
   - Results show all three refinements (AND across sections, OR within Issuer)
   - Options that would give 0 results show disabled, not hidden, so nothing jumps
4. Untick ETFs, pick a **Shares issued** range.
   - Only shares remain, as the "(equities only)" label warns

**Proves:** filtering **[AC]**; live counts prevent dead ends; on a wide screen each change shows in the results straight away.

## 7. Sort

1. Search `vanguard`, load more once, change Sort to **Name A–Z**.
   - Order changes, list resets to the first batch
2. Change to **Units on issue**.
   - Equities first; ETFs (no value) at the end, as the help text says
3. Search something new.
   - Sort choice is kept

**Proves:** re-ordering **[AC]**.

## 8. Zero results: typed query

1. Search `VSG` (a typo of `VGS`).
   - Friendly no-results message with a way forward
   - Console: `[analytics] search_zero_results { term: "VSG" }`

**Proves:** friendly no-results handling **[AC]**.

**Talking point:** the search service logs this itself, with the result count it computed, so the browser never reports numbers that could be wrong or faked. The same log feeds popular searches (terms with results) and insights (terms without). A real build would move the log into an analytics pipeline for daily product-gap reports ("123 users searched `VSG`, 0 results"), which is also where "did you mean" would come from.

## 9. Zero results: too many filters [Extra]

1. Search `bank`, tick **Flagship funds** and an issuer that has no flagship bank funds.
   - "Try removing" chips appear, each with the count you'd get without that filter
2. Click one.
   - Results return

**Proves:** a way out instead of a dead end, without mixing non-matching results into the list.

## 10. Search insights panel [Extra]

1. Click the gear (top right).
   - Zero-result terms grouped by dedupe key, with total count and each variant's count
   - `VSG` from flow 8 appears, counted
2. Search `vsg ` again, reopen.
   - Same group, count ticks up

**Talking point:** this is the view a product owner would get from a real analytics pipeline. Here it's `GET /insights/zero-results` over the API's in-memory search log: a seeded fake history plus every live search. In production it sits behind admin auth.

## 11. Demo settings [Extra]

1. Gear → Settings. Set **Suggestion debounce** to 0 and **min characters** to 1, then type `vanguard` with Network open.
   - A request on nearly every keystroke
2. Reset to defaults, type again.
   - One request pair after the pause
3. Set **Results per load** to 5.
   - Load more now adds 5 at a time, "Showing 5 of …"

4. Turn on **Show raw data**, search `investors`.
   - Grey raw values appear beside labels (`Investors Mutual` *investors_mutual*) and each row shows its ID
   - Two issuer options look alike: the data has `investors_mutual` and `investors mutual`, shown as given

**Talking point:** page size, minimum characters and debounce were judgement calls. Each lives in `config.ts` with a one-line description, and this panel shows the trade-off at other values.

## 12. Accessibility

1. Keyboard only: Tab into the input, type, arrow through suggestions, Enter, Tab to filters, Space to toggle, Tab to Load more.
   - Focus ring visible throughout
2. Screen reader: input announces as a combobox; suggestion count and active option are read out.
3. Hover and select things.
   - Nothing changes size or shifts layout

**Proves:** accessible search input **[AC]**.

## 13. API down

1. Stop the mock API, then search.
   - Error message with a Retry button, not a blank page
2. Restart the API, click Retry.
   - Results load

## 14. Responsive

1. DevTools device toolbar, ~375px wide (mobile, 0–759px).
   - Single column; popular pills scroll on one line; `[Filters]` and `[Sort]` sit above the results
2. Tap **Filters**, tick two options.
   - Drawer counts and "Show X results" update; results behind don't
3. Close the drawer with ×.
   - Changes discarded
4. Reopen, tick again, press **Show X results**.
   - Drawer closes, results apply
5. Tick a filter in the drawer, close it, then run a new search.
   - Pending ticks are discarded; applied filters stay
6. Widen to ~900px (tablet, 760–1029px), then ~1300px (desktop, 1030px+).
   - Two columns: 260px filter rail and results; on desktop the content caps at 1030px and centres
   - Ticking a filter updates the results directly, with no button

**Proves:** mobile-first responsive layout; filters wait for the button on mobile and apply as you tick on tablet and desktop.

---

## Data architecture: ID-first search with hydration

**Principle:** load only what's needed, when it's needed. Search answers *which* instruments match and in what order; a separate store holds *what* each instrument is.

### How a search runs

1. **Search or refinement** (new term, filter or sort) → one call to `POST /search/index`. The server filters and sorts the full match set and returns:
   - `count`: the true total
   - `facets`: counts for all 7 filters
   - `ids`: the first window of matching IDs (up to 1,000), already in sort order
   - `documents`: the first batch (results-per-load, 15 by default), so first paint is a single round trip
2. **Store.** Documents go into a `Map<id, Instrument>`. Instrument data is static, so a document is fetched once and kept for the session.
3. **Load more** → take the next 15 IDs from the window, check the store, and fetch only the missing ones from `POST /instruments/batch`. Often that's zero requests.
4. **Past the window** (more than 1,000 matches) → fetch just the next window of IDs. Count and facets don't change for the same search state, so they aren't re-fetched.
5. **Filter or sort change** → back to step 1 with the new state. The server returns a new ordered ID list; any instrument already in the store renders instantly.
6. **Repeat state** → a search state seen before (same term, filters, sort) is served from cache with no request.

The frontend never filters, sorts or counts. Order comes from the server's ID list; counts always come from the server, computed over the full match set, so they're correct at any scale.

### Why this approach

- **Small, bounded payloads.** Each response is a window of short IDs plus at most one batch of documents, whatever the catalogue size. At ASX scale (~2,500 instruments) the whole ID list is about 10KB gzipped.
- **No duplicate downloads.** The same instrument appears in results, suggestions and recent searches; it's fetched once and shared.
- **Fast refinements.** Changing a filter or sort costs one small request, and rows already in the store appear immediately.
- **Correct counts at any scale.** Counts never depend on what the browser has loaded.
- **Ready for live prices.** Static data (name, logo, issuer) is cached once by ID. Prices would be a separate live layer keyed by ID: the client knows exactly which IDs are on screen, subscribes to just those, and every view of an instrument updates from one place. With documents copied into each search response instead, a price would be stale the moment it arrived, and refreshing it would mean re-running whole searches.
- **Ready for more markets.** IDs are already market-qualified (`VAS:AU`), so `SPY:US` slots in. If each market's data lives in its own service, `/instruments/batch` is the single place that fans out; search stays unchanged.
- **Swappable.** All of this sits behind a `SearchSource` interface, so the UI doesn't know or care how results are fetched.

Full record: [ADR 0001](./adr/0001-id-first-search-with-hydration.md).

### Trade-offs, stated plainly

- It needs two new mock API endpoints (`/search/index`, `/instruments/batch`). They're additive; existing endpoints are untouched. In a real team this is a contract the frontend would help design with the backend.
- Instrument documents are small today (~400 bytes), so the byte savings are modest now. The case rests on scale, live prices and multiple markets.
- Price sort (future) would be a server snapshot: prices tick in place without rows jumping, and the order refreshes only when the user changes sort or reloads.

## Decisions

What was decided and why, in the order it was settled. Open items are listed at the end.

### Stack

| Decision | Why | Rejected |
| --- | --- | --- |
| React + Vite + TypeScript in `web/` | Fast dev server, standard setup, types catch API contract mistakes | Next.js: SSR and routing aren't needed for one page |
| Chakra UI v3 | Themeable, accessible by default, ships Combobox, Pagination, Skeleton and Checkbox, which cover most criteria | Mantine (equally capable, less themeable), Tailwind/shadcn (more assembly for the same result) |
| TanStack Query over `fetch` | Typeahead races, cancelling stale requests, keeping the previous page visible and caching are the hard parts, and it handles all of them. Transport-agnostic, so it fits a GraphQL stack too | Hand-rolled `fetch` hook (more bug surface, no visible gain), SWR (weaker pagination), RTK Query (needs Redux), Apollo/urql (GraphQL only; this API is REST) |
| Search state in React state, not the URL | Sharing or bookmarking searches isn't needed; keeps the URL clean and avoids history handling | Query-string state with back/forward support |
| Extend the mock API with additive endpoints | The API README allows changes. In a real team the frontend shapes the backend contract; ID-first search and a server-side search log need it. Existing endpoints untouched | Working only within the given endpoints |
| ID-first search with hydration ([ADR 0001](./adr/0001-id-first-search-with-hydration.md)) | Load only what's needed; one store per instrument; ready for live prices and more markets; counts always server-computed | Full documents per page; full match set filtered in the browser |
| ID window of 1,000, next window on demand | Bounded payload at any scale; counts stay exact because the server computes them | Hard cap (misrepresents results); all IDs at any size |

### Suggestions and popular searches

| Decision | Why | Rejected |
| --- | --- | --- |
| **Popular search** = most searched across all users; **Recent search** = this user's own history | Different populations, different jobs: guide newcomers vs repeat your own searches | One merged list |
| Popular shown as top 10 pills under the input; recent and suggestions in the input's popup | Popular is visible without interaction; the popup stays focused on what the user is typing | Popular inside the popup only |
| Suggestions fire after 200ms pause and from 3 characters | Fewer wasted calls. The shortest ticker is 3 characters, so every instrument stays reachable | Firing on every keystroke |
| Popup has two groups: search terms and instruments | Terms let users refine before completing the query; instruments jump straight to a match | Instruments only |
| Data reached through seams (`SearchSource`, `SuggestionSource`, `PopularSource`, `RecentSearchStore`) | Real life has thousands of suggested terms and needs a server; swapping an adapter for a real endpoint changes no UI | UI calling the API directly |
| **Search** (a submitted term) vs **Refinement** (filter or sort change) | Only searches count towards popular, become recent searches and emit analytics; refinements are how people slice results, not what they look for | Counting every request |
| Popular and zero-result insights from a server-side search log ([ADR 0002](./adr/0002-server-side-search-log.md)) | Only a server sees all users; the client sends just the term to `POST /searches` and the server computes counts, so they can't be wrong or faked | Hard-coded frontend list; client-reported counts; logging inside `/search/index` (cached repeats would go uncounted) |
| Popular terms deduped on an order-insensitive word set, ignoring `and`, `the`, `of`, `for`, `asx`; `OR` and `etf` kept | `VGS vanguard` and `vanguard VGS` are the same search. `OR` is an API operator, `etf` changes results | Exact-string dedupe |
| Zero-result terms kept in the log, excluded from pills | Zero results is information for Betashares (a product gap), but a dead end for a user | Showing them as pills |
| Popular fetched once on page load | It's an aggregate that changes slowly; polling adds nothing | Live refresh |
| Recent searches: saved when the request fires, last 5, case-insensitive dedupe, removable, localStorage, updated in memory | The user did search for it, even if it failed or found nothing, and retrying from Recent helps after an error | Saving keystrokes; saving only successful searches |

### Analytics and insights

| Decision | Why | Rejected |
| --- | --- | --- |
| `analytics.track()` with a console adapter, 3 events, display only | Shows what production would measure, visible in DevTools during the demo; the server's search log is the source of truth | Real tracking (out of scope), no analytics at all |
| Search insights panel behind a header gear, from `GET /insights/zero-results` | Makes the product-gap idea tangible in the demo | An event log (the console already does that) |
| "Show raw data" setting: raw API values beside formatted ones (issuer, type, units, range buckets, instrument ID), off by default | Shows exactly what the API sends next to what the user sees; makes data-quality issues and cache hits visible in the demo | Always showing raw values; a separate debug build |
| Tunables in one `config.ts`, editable live from a "Demo settings" tab in the gear panel | Page size, minimum characters and debounce were judgement calls; the panel shows what happens at other values | Hard-coded constants scattered through components |

### Results, filters, ordering

| Decision | Why | Rejected |
| --- | --- | --- |
| Cards show logo, ticker, name, type, issuer, flags, units on issue | That's all the data has; no prices or descriptions exist | Inventing fields |
| "Load more" button that appends the next batch, 15 by default | Keeps earlier results in view while scanning; the button keeps the user in control and the footer reachable. Focus moves to the first new row and the new total is announced, covering load-more's usual accessibility gap | Numbered pages (lose your place), auto-loading infinite scroll (no control, unreachable footer) |
| Cards not clickable | The brief doesn't ask for a detail view; a link to nowhere is worse than none | A detail page |
| All 7 filters, with live counts; zero-count options disabled, not hidden | Counts stop users walking into dead ends; disabled keeps the list from jumping | Hiding empty options |
| The frontend displays data as given and never interprets it; data quality is the backend's job | Suspected bad data: duplicate-looking issuer slugs, logos shared across different issuers, no display name. Guessing which values mean the same thing could silently hide or mix results | Merging look-alike slugs; editing the data file |
| Issuer label = display only, from `issuerLabel(slug)` (casing override map, else title-case); the slug stays the value; colliding labels show the slug as a hint | Readable without changing which issuer a value refers to | Raw slugs (looks broken); logo-only (logos are shared across issuers, and filters need text for screen readers) |
| "Portfolio eligible only" and "Units on issue (Equities only)" framing | The raw flags are confusing; the units range silently drops every ETF unless labelled | Exposing raw field names |
| Drill-down: AND across sections, OR within one | Standard faceted search; matches the API | Appending relaxed "OR" results below |
| Zero results with filters: "Try removing" chips with the count you'd get | A way out without mixing non-matching results into the list | Silent empty list |
| Sort by: Recommended (default), Ticker A–Z / Z–A, Name A–Z / Z–A, Units on issue | "Recommended" reads right with or without a query, where "Best match" doesn't. Sort change resets to the first batch | Issuer sort (API sorts on slugs; the filter covers it), units low to high (no common need) |
| Sort in the results header, separate from filters, applied immediately, computed server-side | Sort is how results are shown, filters are which results; sorting only loaded rows would give a wrong order | Sort inside the filter panel; sorting loaded rows in the browser |
| Filters apply as you tick on tablet and desktop, and on a button in the mobile drawer. Counts update live through debounced counts-only requests ([ADR 0003](./adr/0003-refinements-apply-on-button.md), [ADR 0004](./adr/0004-live-filters-on-tablet-and-desktop.md)) | On a wide screen the results sit beside the rail, so each change shows straight away. On a phone the drawer covers the results, so the live total on the button shows what you'll get | A button everywhere (it got missed at the bottom of a tall rail); live updates behind the mobile drawer |
| Applied-filter chips with ×, plus "Clear filters" (filters only), both applied immediately | Shows what's narrowing the results; one tap is a complete decision. Sort is separate, so clearing doesn't touch it | "Clear all" resetting sort too |
| Button wording: "Show 1 result" / "Show 31 results" / disabled "No matching results" | Correct singular/plural; a disabled zero state explains itself | "Apply filters" |

### Layout

| Decision | Why | Rejected |
| --- | --- | --- |
| Mobile-first; mobile 0–759px, tablet 760–1029px, desktop 1030px+ | Most retail investors browse on phones; breakpoints match the site's own content width | Desktop-first |
| Mobile: single column, filters in a drawer, sort beside the Filters button | Results get the screen; filters are one tap away | Filters stacked above results |
| Tablet/desktop: search across the top, 260px filter rail, results on the right; desktop capped at 1030px | Filters stay visible while scanning results | Filters in a top bar |
| Full-width result rows, not a card grid | Instruments are scanned by ticker and name; long fund names fit without truncation | 3-up card grid |

### Security

| Decision | Why | Rejected |
| --- | --- | --- |
| Popular ranked by distinct clients, minimum threshold, per-IP rate limit on logging | Popular pills reach every user, so one script mustn't be able to put a term there | Ranking by raw hits |
| Only terms with results qualify for popular; terms with `OR` excluded | Pill text must match real catalogue words; `OR` would let arbitrary text ride along | Free-text popular terms |
| Validation on new endpoints (enums, ID format, max 100 IDs, body size, term length), capped log with eviction | Rejects malformed input early and stops unique-term floods exhausting memory | Trusting input |
| CORS stays the existing global development policy; rate limits are the abuse control | CORS isn't a security boundary (scripts ignore it), and the mock is a local dev server; claiming an allowlist would be a false security claim | A per-route origin allowlist |
| User text always rendered as text, no `dangerouslySetInnerHTML`; `npm audit` clean | Logged terms are shown back in insights, so they must never run as markup | — |

### Design

| Decision | Why | Rejected |
| --- | --- | --- |
| Theming as a separate phase: build and test on Chakra's default theme first | Separates "does it work" from "does it look right"; semantic tokens only, so theming is config with no component edits | Theming while building |
| Own `DESIGN.md`, correcting the automated extraction | The extraction had an emoji font as body text, invisible borders and failing contrast | Applying it as-is |
| `#dc3703` for text and filled buttons, brand `#fc4d16` for non-text accents | `#fc4d16` on white is 3.4:1 and fails WCAG AA for normal text; `#dc3703` passes at 4.6:1 | Brand-exact coral everywhere |
| Rund Text hotlinked from onlinewebfonts, Inter fallback, never committed | Non-commercial POC for Betashares, who use the font on their own site. The host's licence is unverified, so files are never redistributed and Inter covers outages | Committing the font files (redistribution); Inter only |
| Inputs 5px radius, buttons 15px, cards 10px | Inputs match the live site; the extraction contradicted itself | The extraction's values |

### Testing and code structure

| Decision | Why | Rejected |
| --- | --- | --- |
| Baseline API tests for existing behaviour before any change | The mock had no tests; characterising it first proves the additive changes broke nothing | Testing only new endpoints |
| Minimal backend footprint: new files, reuse existing services, touch existing files only for wiring | The brief is mainly frontend; less change to `api/` means less risk | Refactoring the mock |
| Pure logic in plain TypeScript modules, thin components; DRY | Logic is unit-testable without rendering, and each concept lives in one place | Logic inside components |
| Conventional Commits, atomic, a branch and PR per workstream, no squash | Reviewers can read the history by body of work; each commit is one logical change | One large commit; squash merges |
| Transparent AI use: AI credited in commits, a "How I used AI" section | The brief allows AI "with caution"; showing how it was directed and reviewed is the caution | Hiding or overstating AI use |
| Every test runs with one `npm test`, assuming reviewers have no AI tooling and no browser test tooling | Reviewers clone and run; nothing they need should depend on tools they may not have | Checks that only run with AI or a local browser tool |
| No browser E2E suite: Playwright explored and rejected; cross-boundary risks tested inside `npm test` instead (in-process contract tests, supertest CORS preflight, jsdom focus and live-region checks) | Playwright's browser downloads add hundreds of MB for one flow; the bugs it would catch (contract drift, CORS, focus, timing) are covered without new dependencies. Visual layout stays manual via the demo flows | Playwright smoke flow |

## Architecture talking points

- **ID-first search with hydration**: search returns ordered IDs, a store holds documents, only missing IDs are fetched. Ready for live prices and more markets. See the data architecture section above.
- **Backend contract shaped by the frontend**: two additive search endpoints and a server-side search log, the way a senior frontend engineer would influence the API in a real team.
- **Seams**: `SearchSource`, `SuggestionSource`, `PopularSource`, `RecentSearchStore`, `analytics.track()`. The UI never knows how data is fetched.
- **Data layer**: TanStack Query handles caching (static data, never stale), cancellation and loading states.
- **Security**: popular pills can't be gamed by one script; all new endpoints validate input; user text is never rendered as markup.
- **Design**: Chakra UI v3 themed from `DESIGN.md`, which corrects the automated brand extraction (contrast, invisible borders, wrong body font).
- **Not built, on purpose**: analytics backend, did-you-mean, detail page, prices (not in the data). See the [roadmap](./roadmap.md)'s out-of-scope list.
