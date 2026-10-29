# Roadmap

Features for the instrument search POC, grouped into bodies of work that can be built together. **MVP** items come straight from [`ASSIGNMENT.md`](../ASSIGNMENT.md) or are needed to deliver them; **Extra** items go beyond the brief. Vocabulary follows [`CONTEXT.md`](../CONTEXT.md); styling follows [`DESIGN.md`](../DESIGN.md); the reasoning behind each choice is in [`walkthrough.md`](./walkthrough.md) and [`adr/`](./adr/).

Milestones: **MVP** items form **M1**, a runnable vertical slice that meets every acceptance criterion; **Extra** items form **M2**, whose UI is removable without touching M1 (the search log is an M1 primitive; insights sits behind `ENABLE_INSIGHTS`). The binding contract is [`planning/PLAN.md`](./planning/PLAN.md).

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped · `?` decision still open

---

## 1. API extensions

Additive changes to the mock in `api/`. Existing endpoints and their behaviour stay untouched. Do first: the frontend data layer depends on them. See [ADR 0001](./adr/0001-id-first-search-with-hydration.md) and [ADR 0002](./adr/0002-server-side-search-log.md).

**Minimal footprint:** the brief is mainly frontend. New behaviour goes in new files following the existing controller → service → repository structure, reusing the shared search/filter primitives (a new `searchAll` on `SearchService`) rather than duplicating them; legacy `FacetsService` stays untouched. Existing files change only where wiring requires it (`main.ts`, `package.json`, `api/README.md`).

- [ ] **MVP** Test tooling: Vitest + supertest, `test` script; app creatable without starting the server
- [ ] **MVP** Baseline tests for existing behaviour **before any change**: `/search` text matching and ranking, filters, `order_by`, paging, `/facets/:key`, 400/404 errors

- [ ] **MVP** Internal `SearchService.searchAll()` (full ordered match set); legacy `search()` becomes `paginate(searchAll())`, output unchanged. New index service reuses the shared search/filter primitives; legacy `FacetsService` stays unchanged
- [ ] **MVP** `POST /search/index`: pure and cacheable. `id_offset` / `id_limit` / `document_limit`, `include`, `snapshot`; returns `indexed_at`, `count`, `facets` (all 7, zeros explicit), ordered `ids`, `next_id_offset`, `documents`; 409 on snapshot mismatch. **Exact contract: [PLAN.md](./planning/PLAN.md#api-contract)**
- [ ] **MVP** `POST /instruments/batch { ids, snapshot }`: 1–100 IDs, canonicalised to uppercase, duplicates collapsed, documents and `missing` in request order, 409 on snapshot mismatch. Exact contract: PLAN.md
- [ ] **MVP** `GET /version → { indexed_at }` for client cache restart discovery
- [ ] **MVP** `POST /searches { term, submission_id }` + required `X-Client-Id` → 202: logs every explicit search submission (even if superseded before its results render), idempotent within a 10-minute retry window, server computes unfiltered counts per executable spelling. In memory, bounded, seeded with a fake history. _Changed 2026-10-29 (Israel, docs synced to the code): the log is bounded and persists to a JSON file (`api/data/search-log.json`, `SEARCH_LOG_FILE` overrides). It is seeded once, on the first start, from `api/data/popular-seed.json` (43 entries), then drifts with real use; `npm run reset-log` in `api/` deletes the file. The first users see sensible popular searches, and real use takes over ([ADR 0002](./adr/0002-server-side-search-log.md), #13)._
- [ ] **MVP** `GET /popular`: top N keys whose label spelling returns results, ranked by distinct clients, ≥ 3 clients, no `OR` terms, `includes_seed_data` flag
- [ ] **Extra** `GET /insights/zero-results` behind `ENABLE_INSIGHTS`: keys where no spelling returns results, ≥ 2 clients, spellings with counts
- [ ] **MVP** `dedupeKey()`: clause-aware (`OR` clauses kept, words normalised and sorted within each clause, clauses sorted, malformed operators not logged). Exact rules: PLAN.md step 8
- [ ] **MVP** Security (demo-grade): strict validation on new endpoints, explicit 32KB body limit, per-IP and per-client rate limits on logging, bounded log and submission registry. CORS stays the existing global development policy (not a security boundary), with `X-Client-Id` allowed in preflight
- [ ] **MVP** API tests for each new endpoint (every `include` combination, validation, idempotency, bounds, snapshot 409, CORS preflight); baseline proves legacy behaviour unchanged
- [ ] **MVP** `api/README.md` documents the new endpoints

## 2. Frontend foundation

- [ ] **MVP** React app in `web/` (Vite + TypeScript), served on `http://localhost:3000`
- [ ] **MVP** Root scripts: `setup` (installs both), `dev` (built-in `child_process` runner for API + web), `test` (both suites), plus `web:install`, `web`
- [ ] **MVP** Typed API client over `fetch`
- [x] **MVP** One API gateway, `request(caller, path, init)`: per-attempt timeout, retries for network errors, timeouts and 5xx with doubling backoff, never 4xx or aborts; reports `api_call_failed` once after the final failure to the console and the Data problems panel. Other retry layers are off so attempts don't stack ([ADR 0006](./adr/0006-one-api-gateway-for-retries-and-errors.md)). _Added 2026-10-29 (Israel): one outage had given 4 calls and 4 reports because TanStack's default retries re-ran the query and its error report each time._
- [ ] **MVP** TanStack Query: index and document queries never stale, keyed by one canonical `buildSearchRequest()` plus `indexed_at` and response-shaping values; `/version` refetched on load, focus and reconnect (60s stale time) to invalidate caches after an API restart
- [ ] **MVP** `SearchSource` seam implementing ID-first search: search index cache per search state, `Map<id, Instrument>` document store, hydrate only missing IDs, fetch next ID window on demand
- [ ] **MVP** Chakra UI v3 on its **default theme**; components use only semantic tokens and props (no hard-coded colours, fonts or radii) so theming is config-only later
- [ ] Search state (term, applied filters, sort) held in React state only; the URL stays clean
- [ ] `web/src/config.ts`: one typed object of tunable defaults (results per load, suggestion min characters, suggestion debounce, instrument suggestions shown, popular pills shown, recent searches kept, facet-count debounce, ID window size), each with a one-line description used as the code comment and the settings panel's help text. _Changed 2026-10-29 (Israel, docs synced to the code): "instrument suggestions shown" became "issuer suggestions shown" because the value limits issuer search terms; the instrument matches are always up to 5 (#19). Popular pills are set per screen size (`popularShown`, capped by `popularMax`) and `popularSearchOneLine`, `popularInPopup` and `featuredSearches` were added._
- [ ] Project `CLAUDE.md` via `/init` once `web/` exists

## 3. Layout and app shell

Mobile-first. Breakpoints: mobile 0–759px, tablet 760–1029px, desktop 1030px+.

- [ ] **MVP** Mobile: single column. Header, search, popular pills (one horizontally scrolling line), a `[Filters (n)]` + `[Sort ▾]` row, results. _Changed 2026-10-29 (Israel, docs synced to the code): the pills wrap onto new lines at every width instead of scrolling, and by default (`popularSearchOneLine`) the ones that do not fit on the first line are hidden. How many show depends on screen width (see section 5). _Reason (Israel): horizontal scrolling makes an interface messy and hard to scan, and hides items, so I avoid it._
- [ ] **MVP** Tablet: search and pills span both columns; left column 260px fixed (filters), right column fluid (results header with count and sort, results, messages)
- [ ] **MVP** Desktop: as tablet, content max width 1030px, centred
- [ ] **Extra** Sticky header imitating betashares.com.au: logo, POC title, gear button (top right). Built by Israel; logo at `web/src/assets/betashares-logo.svg`. _Changed 2026-10-29 (Israel, docs synced to the code): the header is not sticky: it scrolls with the page and nothing on the page is sticky (#17). The gear button exists for this demo only; a production version of the page would not have it._

## 4. Search bar and suggestions

The input and its combobox popup. One body of work: shares the input, keyboard handling and the suggestion seam.

- [ ] **MVP** Accessible search input (label, combobox ARIA, visible focus, clear button, 16px text so iOS doesn't zoom)
- [ ] **MVP** Real-time **suggestions** while typing: 200ms debounce, from 3 characters, stale requests aborted
- [ ] **MVP** Two suggestion groups in one keyboard list: **terms** (refine the query before submitting) and **instruments** (top 5 matches)
- [ ] **MVP** `SuggestionSource` seam; adapter uses `/facets/issuer` + `/search?fields=` in parallel. A real build swaps in a `/suggest` endpoint
- [ ] **MVP** A **search** (Enter, suggestion, popular pill, recent search) applies immediately and clears the applied filters (the sort stays); un-applied filter ticks are discarded. _Changed 2026-10-27 (Israel, #20): was "keeps the applied filters"._
- [ ] **Extra** **Recent searches**: last 5, case-insensitive dedupe, newest first, removable, saved when the search request fires (even if it returns zero or errors), `RecentSearchStore` seam over localStorage, updated in memory during the session. _Changed 2026-10-29 (Israel, docs synced to the code): the store keeps 4 (`recentSearchLimit`, so the popup does not scroll, #54), not 5. Entries are not removable: a remove control would need its own popup outside the combobox to stay accessible (#15). A search is saved only once it returns results (count above zero), not when the request fires, so a dead-end search is never offered again (#11).
- [ ] **Extra** Empty focused input shows recent searches (or a short hint if none); at 1–2 characters, only those starting with the typed text; from 3 characters, suggestions replace them. _Changed 2026-10-29 (Israel, docs synced to the code): an empty focused input lists recent searches, then the top five popular searches (`popularInPopup`, #54); "No recent searches yet" shows only when both are empty. At 1 or 2 characters only the recent searches starting with the typed text show, with no popular ones.

## 5. Popular searches

- [ ] **MVP** Top 10 **popular searches** as pill buttons under the input, from `GET /popular`, fetched once on page load. _Changed 2026-10-29 (Israel, docs synced to the code): the number of pills depends on screen width (`popularShown`: 6 on phones, 8 on tablets, 13 on desktops, capped at 15 by `popularMax`), from one request for the largest so resizing never refetches. The pills wrap rather than scroll; `popularSearchOneLine` (on) hides, makes `inert` and `aria-hidden` the ones that do not fit on one line. They sit in a "Popular searches" section that shows only before the first search; "Featured Betashares ETFs" take their place when there is no popular data or the fetch fails (#13). A pick is recorded as a recent search only once it returns results. _Reason for wrapping (Israel): a horizontal scroll was the first idea, and I avoid horizontal scrolling because it makes an interface messy and hard to scan._
- [ ] **MVP** Clicking a pill runs that search (and records it as a recent search)
- [ ] **MVP** `PopularSource` seam over `/popular`

## 6. Results

- [ ] **MVP** Results header: "31 results", sort select
- [ ] **MVP** Result row (full width, not a card grid): logo, ticker, name, type badge, issuer, Betashares / Flagship / Auto Invest badges, units on issue (equities)
- [ ] **MVP** "Load more" pagination: each batch (15 by default) appends to the list, "Showing 30 of 834". _Changed 2026-10-29 (Israel, docs synced to the code): the button text is a fixed "Load more", not templated with the batch size (Israel: fixed text is better), and "Showing 30 of 834" is not on screen; the new total is announced through the live region only ("15 more loaded, showing 30 of 834"). The end-of-results message shows only when the count is above one batch plus `orphanSize`._  Fixed-size button with inline spinner, skeleton rows appended while loading, focus moves to the first new row, `aria-live` announces the new total. End-of-results message once everything is loaded. New search or refinement resets to the first batch. No auto-load on scroll _The total was left off the screen because nobody needs it; the announcement still gives screen reader users a little extra context (Israel)._
- [ ] **MVP** Loading skeletons matching row dimensions for a new search
- [ ] **MVP** Friendly no-results message
- [ ] **MVP** Error state with retry when the API is down. _Changed 2026-10-29 (Israel, docs synced to the tickets): was tagged Extra. Ticket #4 (milestone M1 — MVP) includes "error with Retry", and PLAN.md lists error states under M1._
- [ ] Rows are not clickable (no detail view in the brief)

## 7. Filters and ordering

- [ ] **MVP** Filters (mobile: drawer; tablet/desktop: left rail), each option with its facet count; zero-count options disabled, not hidden:
  - Type: ETF / Equity checkboxes
  - Issuer: top 8 by count + "Show all" with a filter box. The value is always the slug as the API gives it; the label is display only, from a pure `issuerLabel(slug)`: brand-casing override map first (~15 entries such as Global X, VanEck, J.P. Morgan, PIMCO), otherwise split on `_`, `-` and spaces and title-case. Every slug is its own issuer, never merged; when two slugs produce the same label, the raw slug is shown as a muted hint (also on chips)
  - Betashares funds only, Flagship funds, Available for Auto Invest: toggles
  - Portfolio eligible only: toggle (`is_portfolio_excluded: false`)
  - Units on issue: single-select range buckets, labelled "Equities only". _Changed 2026-10-29 (Israel, docs synced to the code): the section is labelled "Shares issued (equities only)" (single-select, with an "Any" option). _Reason (Israel): labels should be user-friendly for people without financial literacy, and teach them the term at the same time._
  - Order of the sections: _Changed 2026-10-29 (Israel, docs synced to the code): Betashares funds only, Flagship funds, Available for Auto Invest, Type, Issuer, Portfolio eligible only, then Shares issued (equities only) last. The order is meant to suit the business and its users. Portfolio eligible only was last in #39 and moved up one place in PR review, because a lone toggle at the very bottom of a tall rail gets missed._
  - Drill-down: sections combine with AND, options within a section with OR. No relaxed "OR" results appended
- [ ] **MVP** **Refinements apply on a button.** Ticking filters sends a debounced (150ms) counts-only request (`include: ["count", "facets"]`) so facet counts and the button total stay live; results are fetched only when the button is pressed. Button: "Show 1 result" / "Show 31 results" / "Show 1,240 results"; disabled "No matching results" at 0; keeps its width while counts load. On tablet/desktop it's sticky at the bottom of the rail and appears only with pending changes. Closing the mobile drawer without pressing discards the changes. _Changed 2026-10-29 (Israel, docs synced to the code): only the mobile drawer (below 760px) has the button, in the drawer footer. Tablet and desktop apply filter changes live after the same debounce, with no button and nothing sticky; the previous results stay on screen, dimmed, until the new ones arrive ([ADR 0004](./adr/0004-live-filters-on-tablet-and-desktop.md), #10).
- [ ] **MVP** Sort select in the results header (not with filters), applied immediately: Recommended (API default), Ticker A–Z / Z–A, Name A–Z / Z–A, Units on issue high to low (equities only, noted). Resets to the first batch; persists across searches and has no reset button (picking Recommended is the reset). _Changed 2026-10-29 (Israel, docs synced to the code): there are 7 options: "Best match" (default, no `order_by`), "ASX code (ticker) A – Z" and "Z – A", "Investment name A – Z" and "Z – A", "Shares issued high – low" and "low – high". The labels are plainer for people new to investing, and shares issued sorts both ways for consistency (a0fc3d1).
- [-] **Extra** Zero results with filters applied: "Try removing" chips per active filter, each showing the count without it. _Dropped 2026-10-27 (Israel, #20): a new search clears filters, and the rail and drawer block zero results, so filtered zero results no longer happen in normal use._
- [ ] **MVP** Applied-filter chips above the results (`ETF ×`, `Vanguard ×`), plus "Clear filters" (filters only; term and sort stay). Removing a chip or clearing applies immediately. Hidden when nothing is applied; scrolls horizontally on mobile. _Changed 2026-10-29 (Israel, docs synced to the code): the chips wrap onto new lines at every width, and a long label is cut with an ellipsis (the accessible name keeps the full label). The chips are tertiary buttons ([`DESIGN.md`](../DESIGN.md))._  The drawer/rail has its own "Clear filters" for pending ticks, still applied with the button _Reason (Israel): the same as the popular pills. I avoid horizontal scrolling because it makes an interface messy and hard to scan._

## 8. Analytics, insights and demo settings

Shows what a production build would measure and lets the presenter tune the judgement calls live.

_Added 2026-10-29 (Israel, docs synced to the code): the gear and its Insights and Settings tabs exist for this demo only. A production version of the page would not have them._

- [ ] **Extra** `analytics.track()` seam with a console adapter (styled `[analytics]` prefix). Display only: the server's search log is the source of truth
- [ ] **Extra** Events: `search_submitted`, `search_zero_results`, `suggestion_selected`. Refinements emit none of them
- [ ] **Extra** Gear panel **Insights** tab: zero-result terms from `GET /insights/zero-results`, grouped by dedupe key, total and per-variant counts
- [ ] **Extra** Gear panel **Settings** tab ("Demo settings"): results per load, suggestion min characters, issuer suggestions shown, popular pills shown per screen size, keep popular pills on one line, recent searches kept, **Show raw data**. Saved to localStorage, with Reset to defaults. _Changed 2026-10-29 (Israel, docs synced to the code): the drawer and tab are titled "Settings", not "Demo settings". The tab saves with "Save and reload" (config is read once at startup), stores only the keys that differ from the `config.ts` default, and shows Reset to defaults only while custom settings are saved. _Changed 2026-10-29 (Israel): every `config.ts` value is a field, grouped under headings, except `settingsEnabled` (turning it off would hide the tab needed to turn it back on) and `searchStaleTimeMs` (Infinity, because `indexed_at` invalidates instead). "Save and reload" sits in the panel footer, and the panel is size `lg`._ It also has "Clear popular searches" and "Restore demo popular searches" buttons that act on the shared search log. _The Clear popular searches and Restore demo popular searches buttons were added for the demo, so it can be re-initialised (Israel)._
- [ ] **Extra** **Show raw data** (`showRawData` in `config.ts`, default off): one `<RawHint value />` component, small muted text that renders nothing when off. Used on: issuer (filter, chips, rows), type, units on issue, units range options, instrument ID at the end of each row. When off, a label collision falls back to the raw values for that pair so options never look identical
- [ ] **Extra** Fix Show raw data layout problems: with it on, the hints break some layouts and a few things (found by Israel testing #19 in the browser; deferred, not fixed in #19). Check the result row, filter rail and chips at 360 and 390 px first
- [ ] Missing logo shows a default placeholder image from `web/src/assets/`

## 9. Quality and delivery

- [ ] **MVP** README: setup, how it works, security notes, what a real build would add
- [ ] **MVP** Clear, meaningful commit messages: Conventional Commits with scopes (`feat(web):`, `test(api):`, `docs:`), atomic, tests in the same commit as their code. One branch per workstream, merged by PR into the fork's `main`, no squash. Israel is the author; AI credited with the short standard trailer
- [ ] **MVP** "How I used AI" section in `docs/walkthrough.md`, accurate and in Israel's voice
- [ ] **MVP** `npm audit` clean in `api/` and `web/`
- [ ] **MVP** No `dangerouslySetInnerHTML`; user-entered text always rendered as text
- [ ] **MVP** Frontend structure for testability: pure logic (hydration planner, recent-search store, wording, request building) in plain TypeScript modules with no React; components stay thin and call them. DRY: one API client, one place per concept
- [ ] **MVP** All tests run with one `npm test`, assuming reviewers have no AI tooling or browser test tooling; no dependencies beyond Vitest, Testing Library, jest-axe and supertest
- [ ] **MVP** Frontend unit tests: `buildSearchRequest`, hydration planner, recent-search store, wording, `issuerLabel`, config
- [ ] **MVP** Contract integration tests (`web/tests/contract/`): real API started as a child process, real API client and `SearchSource` against it
- [ ] **MVP** Component tests (jsdom): combobox keyboard/ARIA contract with jest-axe, filter apply flow (stale counts ignored, fake timers), load-more focus, live-region text, failure, 409 restart
- [ ] No browser E2E suite: Playwright explored and rejected (browser downloads for one flow); visual layout covered manually by the walkthrough's demo flows

---

## 10. Theme (M3)

Separate phase, after M1 and M2 work as wanted.

- [ ] Chakra theme from `DESIGN.md`: brand colours (`#dc3703` text and fills, `#fc4d16` accents), Rund Text hotlinked with Inter fallback, radii (inputs 5px, buttons 15px, cards 10px), focus ring, shadows
- [ ] Visual check across mobile, tablet and desktop; no component edits needed

---

## Out of scope

Documented in the README as next steps, not built.

- A real analytics pipeline (events to a warehouse, daily product-gap reports); the mock's in-memory search log stands in for it
- Admin auth around search insights
- "Did you mean" / synonyms for misspellings (e.g. `VSG` → `VGS`)
- Instrument detail page (`GET /instruments/:symbol` exists but the brief doesn't ask for it)
- Prices, performance, fees (not in the data); price sort and live price updates
- Snapshots for live data beyond the catalogue `indexed_at` protocol (e.g. live prices changing order between windows)
- Syncing recent searches to a user account
- Screen reader item count in the suggestion popup. VoiceOver counts the popup's groups as its items, so a popup of four recent and five popular searches reads "2 items". The popup works and nothing is blocked, but the number is confusing. Two fixes were made on 2026-10-29: a hidden label that inflated the count by one was moved out of the list, and the list's spoken name now gives each group and its size (for example "Recent searches, 4 terms and Popular searches, 5 terms"). The remaining fix needs a decision on how to expose the groups (for example flattening them), and a real VoiceOver check
- Cleaning issuer data at source. Suspected bad data: duplicate-looking slugs (`etf_shares` / `etfshares`, `investors_mutual` / `investors mutual`), logos shared across different issuers (`vaneck.png` on Global X funds), no display name. A backend fix; the frontend displays data as given and doesn't interpret it
- Persisting the search log across API restarts. _Changed 2026-10-29 (Israel, docs synced to the code): no longer out of scope: the log persists to a JSON file (see section 1). A database and an analytics pipeline remain out of scope._
