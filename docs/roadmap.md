# Roadmap

Features for the instrument search POC, grouped into bodies of work that can be built together. **MVP** items come straight from [`ASSIGNMENT.md`](../ASSIGNMENT.md) or are needed to deliver them; **Extra** items go beyond the brief. Vocabulary follows [`CONTEXT.md`](../CONTEXT.md); styling follows [`DESIGN.md`](../DESIGN.md); the reasoning behind each choice is in [`walkthrough.md`](./walkthrough.md) and [`adr/`](./adr/).

Milestones: **MVP** items form **M1**, a runnable vertical slice that meets every acceptance criterion; **Extra** items form **M2**, whose UI is removable without touching M1 (the search log is an M1 primitive; insights sits behind `ENABLE_INSIGHTS`). The binding contract is [`planning/PLAN.md`](./planning/PLAN.md).

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `?` decision still open

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
- [ ] **MVP** `POST /searches { term, submission_id }` + required `X-Client-Id` → 202: logs every explicit search submission (even if superseded before its results render), idempotent within a 10-minute retry window, server computes unfiltered counts per executable spelling. In memory, bounded, seeded with a fake history
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
- [ ] **MVP** TanStack Query: index and document queries never stale, keyed by one canonical `buildSearchRequest()` plus `indexed_at` and response-shaping values; `/version` refetched on load, focus and reconnect (60s stale time) to invalidate caches after an API restart
- [ ] **MVP** `SearchSource` seam implementing ID-first search: search index cache per search state, `Map<id, Instrument>` document store, hydrate only missing IDs, fetch next ID window on demand
- [ ] **MVP** Chakra UI v3 on its **default theme**; components use only semantic tokens and props (no hard-coded colours, fonts or radii) so theming is config-only later
- [ ] Search state (term, applied filters, sort) held in React state only; the URL stays clean
- [ ] `web/src/config.ts`: one typed object of tunable defaults (results per load, suggestion min characters, suggestion debounce, instrument suggestions shown, popular pills shown, recent searches kept, facet-count debounce, ID window size), each with a one-line description used as the code comment and the settings panel's help text
- [ ] Project `CLAUDE.md` via `/init` once `web/` exists

## 3. Layout and app shell

Mobile-first. Breakpoints: mobile 0–759px, tablet 760–1029px, desktop 1030px+.

- [ ] **MVP** Mobile: single column. Header, search, popular pills (one horizontally scrolling line), a `[Filters (n)]` + `[Sort ▾]` row, results
- [ ] **MVP** Tablet: search and pills span both columns; left column 260px fixed (filters), right column fluid (results header with count and sort, results, messages)
- [ ] **MVP** Desktop: as tablet, content max width 1030px, centred
- [ ] **Extra** Sticky header imitating betashares.com.au: logo, POC title, gear button (top right). Built by Israel; logo at `web/src/assets/betashares-logo.svg`

## 4. Search bar and suggestions

The input and its combobox popup. One body of work: shares the input, keyboard handling and the suggestion seam.

- [ ] **MVP** Accessible search input (label, combobox ARIA, visible focus, clear button, 16px text so iOS doesn't zoom)
- [ ] **MVP** Real-time **suggestions** while typing: 200ms debounce, from 3 characters, stale requests aborted
- [ ] **MVP** Two suggestion groups in one keyboard list: **terms** (refine the query before submitting) and **instruments** (top 5 matches)
- [ ] **MVP** `SuggestionSource` seam; adapter uses `/facets/issuer` + `/search?fields=` in parallel. A real build swaps in a `/suggest` endpoint
- [ ] **MVP** A **search** (Enter, suggestion, popular pill, recent search) applies immediately and keeps the applied filters; un-applied filter ticks are discarded
- [ ] **Extra** **Recent searches**: last 5, case-insensitive dedupe, newest first, removable, saved when the search request fires (even if it returns zero or errors), `RecentSearchStore` seam over localStorage, updated in memory during the session
- [ ] **Extra** Empty focused input shows recent searches (or a short hint if none); at 1–2 characters, only those starting with the typed text; from 3 characters, suggestions replace them

## 5. Popular searches

- [ ] **MVP** Top 10 **popular searches** as pill buttons under the input, from `GET /popular`, fetched once on page load
- [ ] **MVP** Clicking a pill runs that search (and records it as a recent search)
- [ ] **MVP** `PopularSource` seam over `/popular`

## 6. Results

- [ ] **MVP** Results header: "31 results", sort select
- [ ] **MVP** Result row (full width, not a card grid): logo, ticker, name, type badge, issuer, Betashares / Flagship / Auto Invest badges, units on issue (equities)
- [ ] **MVP** "Load more" pagination: each batch (15 by default) appends to the list, "Showing 30 of 834". Fixed-size button with inline spinner, skeleton rows appended while loading, focus moves to the first new row, `aria-live` announces the new total. End-of-results message once everything is loaded. New search or refinement resets to the first batch. No auto-load on scroll
- [ ] **MVP** Loading skeletons matching row dimensions for a new search
- [ ] **MVP** Friendly no-results message
- [ ] **Extra** Error state with retry when the API is down
- [ ] Rows are not clickable (no detail view in the brief)

## 7. Filters and ordering

- [ ] **MVP** Filters (mobile: drawer; tablet/desktop: left rail), each option with its facet count; zero-count options disabled, not hidden:
  - Type: ETF / Equity checkboxes
  - Issuer: top 8 by count + "Show all" with a filter box. The value is always the slug as the API gives it; the label is display only, from a pure `issuerLabel(slug)`: brand-casing override map first (~15 entries such as Global X, VanEck, J.P. Morgan, PIMCO), otherwise split on `_`, `-` and spaces and title-case. Every slug is its own issuer, never merged; when two slugs produce the same label, the raw slug is shown as a muted hint (also on chips)
  - Betashares funds only, Flagship funds, Available for Auto Invest: toggles
  - Portfolio eligible only: toggle (`is_portfolio_excluded: false`)
  - Units on issue: single-select range buckets, labelled "Equities only"
  - Drill-down: sections combine with AND, options within a section with OR. No relaxed "OR" results appended
- [ ] **MVP** **Refinements apply on a button.** Ticking filters sends a debounced (150ms) counts-only request (`include: ["count", "facets"]`) so facet counts and the button total stay live; results are fetched only when the button is pressed. Button: "Show 1 result" / "Show 31 results" / "Show 1,240 results"; disabled "No matching results" at 0; keeps its width while counts load. On tablet/desktop it's sticky at the bottom of the rail and appears only with pending changes. Closing the mobile drawer without pressing discards the changes
- [ ] **MVP** Sort select in the results header (not with filters), applied immediately: Recommended (API default), Ticker A–Z / Z–A, Name A–Z / Z–A, Units on issue high to low (equities only, noted). Resets to the first batch; persists across searches and has no reset button (picking Recommended is the reset)
- [ ] **Extra** Zero results with filters applied: "Try removing" chips per active filter, each showing the count without it
- [ ] **MVP** Applied-filter chips above the results (`ETF ×`, `Vanguard ×`), plus "Clear filters" (filters only; term and sort stay). Removing a chip or clearing applies immediately. Hidden when nothing is applied; scrolls horizontally on mobile. The drawer/rail has its own "Clear filters" for pending ticks, still applied with the button

## 8. Analytics, insights and demo settings

Shows what a production build would measure and lets the presenter tune the judgement calls live.

- [ ] **Extra** `analytics.track()` seam with a console adapter (styled `[analytics]` prefix). Display only: the server's search log is the source of truth
- [ ] **Extra** Events: `search_submitted`, `search_zero_results`, `suggestion_selected`. Refinements emit none of them
- [ ] **Extra** Gear panel **Insights** tab: zero-result terms from `GET /insights/zero-results`, grouped by dedupe key, total and per-variant counts
- [ ] **Extra** Gear panel **Settings** tab ("Demo settings"): results per load, suggestion min characters, suggestion debounce, instrument suggestions shown, popular pills shown, recent searches kept, **Show raw data**. Saved to localStorage, with Reset to defaults
- [ ] **Extra** **Show raw data** (`showRawData` in `config.ts`, default off): one `<RawHint value />` component, small muted text that renders nothing when off. Used on: issuer (filter, chips, rows), type, units on issue, units range options, instrument ID at the end of each row. When off, a label collision falls back to the raw values for that pair so options never look identical
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
- Cleaning issuer data at source. Suspected bad data: duplicate-looking slugs (`etf_shares` / `etfshares`, `investors_mutual` / `investors mutual`), logos shared across different issuers (`vaneck.png` on Global X funds), no display name. A backend fix; the frontend displays data as given and doesn't interpret it
- Persisting the search log across API restarts
