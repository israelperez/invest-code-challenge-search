# Walkthrough (full)

This walkthrough follows the order of the brief ([ASSIGNMENT.md](../ASSIGNMENT.md)). Each section opens with what the brief asked for and the problem it creates, then shows the flows (the good ones, then the bad ones), then explains how it works, why it was built that way and the UI choices behind it. The last section covers what nobody asked for but I thought the page needed. Short definitions of repo terms live in [CONTEXT.md](../CONTEXT.md).

Everything here runs from the page, apart from the API-down flow in section 5, which stops and restarts the API. The console shows the telemetry (`[analytics]` lines for what users do, and warnings for data problems), so keep it open.

Sections:

- Opening
- What the brief gave, and what was added
- 1. Predictive search suggestions
- 2. Search bar and no results
- 3. Search results and pagination
- 4. Filters and ordering
- 5. Loading states
- 6. Added because I judged it necessary
- Close
- Then the reference half: data architecture, decisions, and architecture talking points

## Before you start

1. `npm run dev` (API on `:8787`, app on `:3000`). Open `http://localhost:3000` in a fresh browser profile, so there are no recent searches.
2. Gear Icon → Settings → **Restore demo popular searches**, so the pills match rehearsal. Your demo searches add to the popular list in the file, so do this before each run.
3. Open DevTools on the **Console** tab and clear it. Put the browser window at desktop width (about 1300px).
4. Turn **Show raw data** off, and leave every other setting at its default.
5. Optional: open the **Network** tab (filter `Fetch/XHR`) to show the requests behind each flow, and have VoiceOver or another screen reader ready for the accessibility flow in section 2.

## Opening

What it is, the ideas behind it, and what you'll show.

- A search page for ASX-listed instruments, in React against the mock API. I'll go through the brief in order and show what I added around each part.
- The server does the filtering, sorting and counting. Search returns IDs and a store holds the documents. Data sources sit behind interfaces.
- I added to the mock API where my solution needed it. The additions are new endpoints, and the original ones behave as before. The next section lists them, and each section after it says where the backend comes in and why.
- The console: Everything users do prints here as `[analytics]`, and anything wrong with the data prints as a warning.

**Why extend the API.** The brief says to build against the mock, and its README says you needn't change it, though it allows changes. I extended it anyway, because the solution needed things the original couldn't give:
- IDs without full documents
- counts for every filter in one call
- a view of what all users search

The extension is additive. The original endpoints keep their behaviour (quirks included), and I created baseline tests (tests of the original behaviour, written before I changed anything) to pin that. During the plan review, an adversarial AI reviewer (Codex) argued I should build against the original endpoints only and present the rest as future work. I kept the extension on purpose, because I believe it is the better approach and shows how a frontend engineer can shape a backend contract.

**One config file for every tunable.** Every value that could reasonably be tuned (the suggestion delay, page size, minimum characters, how many pills show, API retries and timeout) lives in one file, `web/src/config.ts`, each with a one-line description, and not as a number buried in a component. Values are easy to find and change, and the Settings tab (section 6) reads the same descriptions as its help text. Where a value in this walkthrough can be changed this way, I give its config name once, at first mention.

**Built to be reused and to scale.** The search box, the result rows and the ID-first hydration system are designed around one idea: the UI never knows what it is searching or where the data comes from. Data reaches the page through seams (`SearchSource`, `SuggestionSource`, `PopularSource`, `RecentSearchStore`), so swapping an adapter changes the data and leaves the UI alone. The same design should suit other uses, such as searching documents or page content, with minor tweaking for each. The principle also covers growth: the same ID-first design is what lets this page take live prices and more markets later. I have not run it against anything but ASX instruments, so this is what the design allows, not something I have tested. Seams are told in section 1, and ID-first search and the growth cases in section 3.

**How the work is split.** The plan has three milestones, ordered to control risk. M1 is the MVP, and the plan defines the MVP as what the brief asks for plus whatever is needed to deliver it: a runnable slice that meets every acceptance criterion in [ASSIGNMENT.md](../ASSIGNMENT.md) and could be submitted on its own. M2 is what the brief did not ask for (recent searches, console analytics, the header, insights, settings, raw data), each removable without touching M1, so none of them could put the MVP at risk. M3 is the Betashares theme, applied last: M1 and M2 were built and tested on Chakra's default theme using design tokens only, so the theme landed as configuration with no component edits. The roadmap lists 68 items, split into MVP items and extras.

**Assumptions I made.** The brief leaves these open, so I stated them and built to them.
- The reviewers marking this have no AI tooling and no browser test tooling, so every test runs from one `npm test`.
- The instrument data is static and changes only when the API restarts. That is why the page uses a snapshot token (section 3) and not a live feed.
- The data holds no prices, descriptions or detail fields, so result rows show only what exists and are not clickable (the brief asks for no detail view). I further assumed that pricing data would come from a separate API call, so I optimised for fast load times by keeping the static documents light. Real-time data would then be requested only for the instruments loaded on the page, not for every match in the full result, including those not yet shown (section 3).
- The client ID that tells users apart is a random value the browser keeps, so anyone can fake one. "Different users" is therefore a guess, and the search log is demo-grade protection only (section 1).
- The search log is one file on one API instance. A real build would use a database.
- Sharing or bookmarking a search is not required, so search state lives in React and not the URL (section 4).
- Rund fonts are hotlinked from betashares.com.au for a non-commercial proof of concept, with Inter as the fallback (section 6).

**Accessibility issues in the reference page and style guide.** The look follows the current Betashares fund page and style guide, matched exactly. Matching the brand is an important requirement for this project, so I decided to do that first. That brand fails WCAG (Web Content Accessibility Guidelines) 2.2 level AA in places. Here are some of the issues I found:
- White text on the brand orange, 3.38:1 (needs 4.5:1). Seen on the Search button, ticker pills and checked controls.
- Orange text and icons on the grey page, 2.90:1 (needs 3:1 for large text, 4.5:1 for normal).
- Light grey text on light backgrounds, 2.24 to 4.19:1 (needs 4.5:1). Seen in placeholders and disabled or zero-count filter options.
- Light outlines on form controls, 1.17 to 1.36:1 (needs 3:1, WCAG 1.4.11). Seen on checkbox, radio and select borders.
- The borderless white search field on the grey page, 1.17:1 (needs 3:1, WCAG 1.4.11).
- Text under 16px: pills, badges, helper text, labels and counts.
- Hover orange with white text, 4.03:1 (needs 4.5:1).

Why I kept them: I wanted this app to look like it belongs to Betashares, with no drift between the two UIs. Fixing most of these would change the colours, sizes and outlines enough to cause that drift. Matching the brand exactly first also leaves a clean before and after, and a bounded fix list with a measured ratio for each item. Each failing pair is in a named allow-list in `web/src/theme.test.ts`, which asserts it still fails by about that ratio, so the list can't go stale. I tried two fixes and measured both (`#dc3703` on white at 4.57:1, dark text on the orange at 5.89:1) and rejected both for now, because each moves away from the brand. Everything else passes. The fix pass is the backlog for a future piece of work ([ADR 0005](./adr/0005-match-brand-then-fix-wcag.md)).

**Problems in the data.** The mock data has quality problems, and I decided early that the page shows the data as given and never interprets it.
- *Look-alike issuers.* The same issuer appears under slightly different values, for example `investors_mutual` and `investors mutual`, or `etf_shares` and `etfshares`. They look like duplicates, but I can't be sure they mean the same thing.
- *Shared logos.* The same logo file is used for different issuers (`vaneck.png` is on Global X funds).
- *Missing data.* There is no display name for an issuer, and some logos are missing.
- *Units on issue.* ETFs have no units, so a units range silently drops every ETF. The ranges also share edges, so a value exactly on an edge would count in two.

How I handled each:
- I did not merge look-alike issuers. Guessing which values mean the same thing could silently hide or mix results, and cleaning data is the backend's job. It is on the roadmap as a backend fix.
- The issuer label is display only, built from the value. The filter still sends the real value. When two labels collide, **Show raw data** (section 6) shows the raw value beside each.
- A missing logo falls back to a default image, and logos load so a bad one never shows as a broken image (section 3).
- The units range is labelled "Shares issued (equities only)" so the missing ETFs are no surprise. I kept the API's range edges as they are, because no instrument currently sits on an edge, and a test asserts that (section 4).

## What the brief gave, and what was added

**The starting point.** The brief ([ASSIGNMENT.md](../ASSIGNMENT.md)) asked for a search page on `localhost:3000`, built against the mock Search API in `api/`. The API came with `/search`, `/facets/*` and `/instruments/:id`, and its README allows changes. There was no frontend.

- **Predictive suggestions, refine by suggested term, popular terms surfaced**
  - Built in the page: Combobox with two groups (terms and instruments), popular pills, recent searches
  - Backend behind it: Existing `/facets/issuer` and `/search?fields=` for suggestions. New `GET /popular` from the search log
  - Why and how: section 1 (why two groups, why from 3 characters, the pills, the search log)
- **Search bar, real-time suggestions, friendly no-results**
  - Built in the page: Accessible combobox input, no-results message
  - Backend behind it: New `POST /searches` logs the term and counts its results server-side
  - Why and how: section 2 (an accessible search box, the no-results flow). The logging is in section 1
- **Results below the bar, useful info, pagination**
  - Built in the page: Full-width rows, "Load more" batches
  - Backend behind it: New `POST /search/index` and `POST /instruments/batch`, with the `indexed_at` snapshot token
  - Why and how: section 3 (ID-first search, hydration, the snapshot token, why Load more)
- **Filter and re-order**
  - Built in the page: Seven filters with live counts, applied chips, sort
  - Backend behind it: Counts for all seven filters and server-side sort from `POST /search/index`
  - Why and how: section 4 (how the counts stay right, live filters against the button, the layout by screen size)
- **Loading and skeleton states**
  - Built in the page: Skeleton rows, dimmed previous results, fixed-size buttons
  - Backend behind it: First documents inline in the search response
  - Why and how: section 5 (the data layer, failure handling)

**Added beyond the brief.** Each is explained in the section named.

- Backend: the search log (`POST /searches`, `GET /popular`; section 1), snapshot token and `GET /version` (section 3), the dev-only `GET /insights/zero-results` (section 6), and restore for the log (section 6).
- Page: recent searches (section 1), console analytics (section 2), the Insights panel (zero-result terms and data problems), a Settings tab for demo values, Show raw data, the header, and a theme matched to the Betashares site (all section 6).
- Process: baseline tests for the original API before any change, ADRs (architecture decision records: a short write-up of a decision and the options rejected) for the main decisions, and one `npm test` that runs everything (tests in section 6, ADRs in the sections where each decision is told).

**What stayed the same.** The original endpoints behave as they did. The only change inside them is that `search()` now sits on a shared `searchAll()`, pinned by baseline tests.

## 1. Predictive search suggestions

**The brief asked for:** suggestions from relevant queries, refining by picking a suggested term, and commonly searched terms surfaced.

**The problem to solve:** the suggestion popup has two states, and each needs different data.
- *Before 3 characters (empty box, or 1 to 2 characters).* There is too little to predict from (the 3 is a setting, `suggestionMinChars`), and 1 or 2 characters are more likely noise than intent, so a request would be wasted. More useful, the popup shows your recent searches instead (the latest four, `recentSearchLimit`). On an empty box it also shows the top five popular searches (`popularInPopup`) below them. Popular searches are already loaded in the app, so showing them costs no request: a free win, and the same list appears on any page in the app that has the search bar.
- *From 3 characters.* The page now has enough to suggest well, and it assumes the user is no longer after a recent search. So it offers terms and instruments that exist in the data.

The original API cannot cover the first state, because it has no idea what users search. That state shows two lists that come from different places:
- *Recent searches* are your own, so they stay in your browser (localStorage) and need no API.
- *Popular searches* mean most searched across all users, which only a server can know. A hard-coded list in the browser couldn't show real usage. So the page asks the server for popular searches once, with a new `GET /popular` call built from a search log.

The original API does cover the second state: it can list issuers and match instruments.

The flows below show the result. The reasoning follows.

**Demo flows**

- *Good flow: before you type.* Load the page: skeleton rows, then results, with the popular pills in their own "Popular searches" section under the input.
  - Click `Gold`. Console: `search_submitted { source: "popular" }`.
  - Focus the empty box. **Recent searches** list your own latest four (`Gold` is there now), then the top five **Popular searches** below them. Pick one and the console shows `source: "recent"` or `"popular"`.
  - Search `bank`, `gold`, then `BANK` again. Recent searches show `BANK` once at the top: duplicates are matched ignoring case, and searching again moves it up.
  - Type `ba`. Only the recent searches starting with `ba` show. At `ban`, suggestions replace them.
- *Good flow: as you type.* Open the Network tab, clear the box and type `van` one key at a time.
  - At `van`, after a pause, one request pair fires, not one per keystroke. The popup shows two groups: **Suggested searches** (Vanguard, VanEck) and **Matching shares and ETFs**.
  - Arrow down and Enter on **Vanguard**. The search runs. Console: `[analytics] suggestion_selected { query: "van", value: "Vanguard", kind: "term" }`, then `search_submitted { term: "Vanguard", source: "suggestion" }`.
  - Clear the box and type `vang` quickly: the earlier in-flight requests are cancelled and show as cancelled in Network.
  - Clear the box and type `a20`. Pick the `A200` instrument from **Matching shares and ETFs**. The search runs for that ticker and A200 is the top result.
- *Bad flow: too short.* While typing `van`, at `va` nothing appears and Network stays quiet, because suggestions start at 3 characters. The shortest ticker is 3 characters, so every instrument is still reachable.
- *Bad flow: not found.* Search `qqqqq`. No results, and it isn't saved to Recent searches, so the list never offers a dead end.

**How it works: suggestions as you type**

1. After a 200ms pause (a debounce, so one request fires per pause and not per keystroke; a setting, `suggestionDebounceMs`) and from 3 characters, the page makes two calls in parallel. Stale ones are aborted when you keep typing.
2. The search terms come from one call to the original `/facets/issuer`, made once and kept. The page matches your text against the issuer names by word prefix, locally.
3. The matching instruments are the top five from the original `/search?fields=symbol,symbol_openfigi,display_name,logo` with `size: 5` in the body. The `fields` parameter keeps the response light.
4. Both calls sit behind a `SuggestionSource` interface, a boundary that lets the data source be swapped without touching the UI, otherwise known as a seam. A real build would replace both calls with one `/suggest` endpoint backed by a query log.

I fetch the full issuer list once and match locally because of what `/facets/issuer` does when you send it text. It returns the issuers of any instrument that matches your text anywhere, so `van` could bring back an issuer only because one of its funds has `van` somewhere in its name. That isn't "issuers that start with `van`", so it wouldn't give the suggested terms the brief describes. Fetching the whole list once and matching your typing against the issuer names by word prefix does. An adversarial AI reviewer (Codex) in the plan review pointed this out.

**How it works: popular searches and the search log**

Popular means most searched across all users, and only a server sees all users. So the server keeps a search log.

1. Each time you submit a search (Enter, a suggestion, a pill or a recent search), the page sends `POST /searches` with the term, a fresh `submission_id` and a client ID. It is a normal request that never blocks the results. If it fails, only the development logs hear about it. Filters, sort, counts and the first load never call it. Every explicit submission is logged, even if you submit again before the results render.
2. The server turns the term into a dedupe key, a normalised form so that searches meaning the same thing count together. It trims, splits on an uppercase `OR`, lowercases each clause, drops `and`, `the`, `of`, `for` and `asx` (keeping `etf`, which changes results), removes duplicate words, and sorts the words and the clauses. So `VGS vanguard` and `vanguard VGS` are one term, and `VGS ASX` folds into `VGS`. A blank term, a term of only stop words, or a malformed `OR` (leading, trailing or repeated) gets an empty key and isn't logged.
   - *A conscious choice.* This cleaning is for the log only. The search itself always runs on exactly what the user typed: nothing is dropped, reordered or rewritten, so results are never influenced by script guessing about what a user meant. The log has the opposite job. For popular searches to mean anything, `VGS vanguard`, `vanguard VGS` and `VGS ASX` must count together, so the log works from a cleaned copy of each term, and that copy never reaches the search endpoint.
3. The server counts the matches itself, without any filters, for that exact spelling. It does this per spelling because dropping stop words can change what a search returns, so two spellings under one key can have different counts.
4. It records the key, spelling, client, count and `submission_id`. A retry with the same `submission_id` inside ten minutes is counted once, which is what makes the endpoint idempotent (safe to retry without counting twice).
5. `GET /popular` lists a key when one of its spellings returns results, at least 3 different clients searched it, and it has no `OR`. The label shown is the most frequent spelling that returns results. They rank by distinct clients, then total searches. The page fetches the list once on load. If the fetch fails, I decided the skeleton pills stay and the gateway reports the failure, instead of showing a made-up list that would give false confidence while the backend has a problem.
6. The log is saved to a file about a second after each recorded search, and seeded once on the first start with a fake history of 43 entries that favours the Betashares flagships. After that real use takes over and the log drifts from the seed. The seed solves the cold start: the first users to open the page see sensible pills instead of an empty row. The UI doesn't label the pills as demo data. The docs and the API's `includes_seed_data` flag say so.
7. Recent searches stay in the browser (localStorage), because they belong to one user. A search is saved once it returns results, the list keeps the last four, and entries aren't removable. A × on each entry would need its own popup outside the combobox to stay accessible, which is more work than this needs.

**Why this way**

*In one sentence:* the server counts and ranks searches, so the numbers can't be faked by the page and one script can't flood the pills, at the cost of a log that needs bounds and gives demo-grade protection only.

- *Benefits.* Only a server sees all users, so popular is real. The client sends just the term and the server works out the count, so the number can't be wrong or faked. Ranking by distinct clients with a minimum of 3 raises the cost of pushing a term up. Because logging is a separate request, the results endpoint (`/search/index`, section 3) stays pure and cacheable: a repeated search costs one tiny log request and no result request. Insights (section 6) reads the same log, so one mechanism serves both what guides users and what reveals product gaps.
- *Protection and its limits.* The pills reach every user, so the log is an attack surface. Writes are rate limited per IP (60 a minute, burst 20) and per client (20 a minute, burst 10); over the limit the search still works but isn't logged. The log is bounded: 5,000 keys, 1,000 distinct clients per key, 10 spellings per key and 10,000 remembered `submission_id`s, evicting the lowest distinct-client count first, then the oldest. Only terms with results qualify and terms containing `OR` are excluded, so arbitrary text can't ride along with a real word. Rate-limit drops, bad requests and evictions print one JSON line to the console, never the term. The honest limit is the client ID: it is a random UUID the browser keeps in localStorage, so anyone can fake one. "Different users" is a guess. Rate limits slow a flood and don't stop it, and they reset when the API restarts.
- *Alternatives I rejected.*
  - A hard-coded popular list in the browser. It can't show real usage, and the dedupe would live in the wrong place.
  - A `POST /events` endpoint with counts reported by the client. The server would have to accept whatever the page says, such as how many results a term returned, and anyone can send any number to an endpoint. A script could make a term look popular or hide a real zero-result term. Sending only the term and letting the server count means the number can't be wrong or faked.
  - Logging inside `/search/index`. A repeated search is served from the browser cache (section 3) and never reaches the server, so it would go uncounted. Bypassing the cache to fix that throws away the performance benefit.
- *Costs.* The log is a file, so it means one API instance, and a real build would use a database and an analytics pipeline. Saved result counts go stale if `instruments.json` changes, so `npm run reset-log` deletes the file. The rate limits and submission IDs aren't saved. Everything past the seed is only as real as the users who used it.
- *What changed along the way.* My first design logged searches inside `/search/index`. Both independent AI reviewers found the caching hole, and I decided to log through a separate `POST /searches` instead. A later round caught that remembering every `submission_id` was itself an unbounded memory risk, so I gave the registry a cap and a ten-minute expiry. Another round showed that counting per dedupe key was unsound, because spellings under one key can return different results, so I decided to count per spelling and added a key-level flag that records whether any spelling ever returned results. That stops a dropped spelling from turning a mixed key into a false zero-result insight. The AI also pointed out that popular searches would have nothing to go off at first, so the pills would start empty. I decided to start the log from a cold-start list, the seeded fake history in step 6. I also documented the log as persisted to a file, where my first note said "in memory".
- *A challenge I kept.* During the plan review, the AI reviewer said popular searches were over-designed for fake data, and that a fixed list of seeded terms would do. I disagreed and kept the real loop (submit, log, rank). A fixed list would look the same on screen, but it can't show the hard parts: the server counting results itself so the numbers can't be faked, ranking by distinct clients, and protecting pills that every user sees. So I built the loop, hardened it, and labelled it demo-grade. I still use a seeded list, but only for the cold start.

**UI choices and why**

- The popup never mixes recent searches and suggestions (the two states above). A list that changes meaning mid-word is confusing, so recent searches stay until the third character and suggestions then replace them. Popular and recent are also kept apart on purpose: popular guides new users, recent helps repeat your own searches.
- Two groups in one popup, search terms and instruments. Terms let you refine before completing the query. Instruments jump straight to a match.
- The popular pills show 6, 8 or 13 depending on screen width (`popularShown`), from one request for 13. The numbers are arbitrary: they show the count can be set per breakpoint. With `popularSearchOneLine` on, any pill that would wrap is clipped, made `inert` (not focusable or clickable) and hidden from screen readers, so none is cut in half or reachable by Tab. They show only before the first search, then the results take their place.
- A new search clears the applied filters and keeps the sort. A pill or recent search counts as a search, so it behaves the same. The reason is about filters, so it is told with them in section 4.
- Search and Refinement are different things. A Refinement is a change of filter or sort (section 4). Only searches count towards popular, become recent searches and emit analytics. Refinements are how users slice results, not what they look for.

## 2. Search bar and no results

**The brief asked for:** an accessible, good-looking input, real-time suggestions, and a friendly no-results message.

**The problem to solve:** a search box is the one control every user uses, so it has to work for users who navigate by keyboard or screen reader, not only for users with a mouse. And a search that finds nothing shouldn't be a dead end for the user, even though for the business it is useful information: a term users keep searching with no results is a product gap.

**Demo flows**

- *Good flow: no layout shift.* Hover and select things. Nothing changes size or shifts the layout.
- *Bad flow: a typo.* Search `VSG` (meant `VGS`). A friendly no-results message with a way forward. Console: `[analytics] search_zero_results { term: "VSG" }`.

**How it works: an accessible search box**

Accessibility isn't a feature I added because the brief mentioned it. Good web code is accessible from the ground up, and semantic code (the right element, a real label, a proper landmark) covers most of it. The brief asked for an accessible input, and this is what building the box properly looks like.

*Structure and labels*
1. The form is a `search` landmark, so a screen reader user can jump straight to it.
2. The input has a visible label, "Search shares and ETFs", tied to it. The placeholder only gives an example (`e.g. A200 or Australia 200`), and the helper text, "Search by ASX code (ticker) or name", stays visible while typing, which a placeholder would not.
3. The magnifier icon is hidden from screen readers. The clear button is named "Clear search" and returns focus to the input.

*The combobox*

The input is a Chakra combobox, built on Ark UI, which follows the WAI-ARIA combobox pattern. ARIA is the set of attributes that tell a screen reader what a custom control is. The contract I wrote down and tested:

4. Arrow Up and Down move through both groups, and Home and End jump to the first or last option.
5. Enter selects. Escape closes the popup, and a second Escape clears the box. Tab closes the popup and moves on, and blur closes it.
6. Focus stays in the input. `aria-activedescendant` tells a screen reader which option is highlighted, so it reads each option as the user arrows onto it.
7. The list has a hidden name that gives each group and its size, for example "Recent searches, 4 terms and Popular searches, 5 terms", and each group has a label. A screen reader counts groups, not the options inside them, so the name carries the real counts. It is hidden text, never shown on the page.
8. Loading, result count and "no suggestions" states are announced through a polite live region, a hidden area that screen readers read out when its text changes. Polite means it never interrupts typing. It is always on the page, so the change is picked up, and it is a live region and not a status role because the results already own the page's one status role.

*Keyboard and touch*

9. Everything works from the keyboard. Focus order is input, clear, search, and the focus ring stays visible. The border turns the accent colour on focus.
10. The input text is 16px so iOS doesn't zoom in on focus, and the field is 48px tall on phones and 62px from desktop, a comfortable touch target.
11. Hover, focus and selection never change the size of anything, so nothing shifts under the pointer.

*Flow: keyboard and screen reader*

Turn on VoiceOver (Cmd+F5 on a Mac) and put the mouse aside.
- **Tab** into the box. The screen reader reads the label, "Search shares and ETFs", and that it is a combobox (a text input with a popup list of options).
- Type `van`. Your typing is echoed as normal, and after a short pause it announces the number of suggestions.
- **Down arrow** moves through the suggestions across both groups, and each option is read as it is highlighted. **Up arrow** goes back, and **Home** and **End** jump to the first and last option.
- **Escape** closes the popup. A second **Escape** clears the box. Type `van` again to bring the popup back.
- **Enter** on a highlighted option runs that search. If nothing is highlighted, Enter searches the text as typed.
- **Tab** moves on to the clear button, then Search (**Shift+Tab** goes back), then the filters. **Space** toggles a filter, and **Tab** carries on to Load more. The focus ring stays visible throughout.

*Checked by*

12. `jest-axe` (automated accessibility checks) on the open list, plus keyboard-focused component cases. A real screen reader pass stays manual, and the keyboard and screen reader flow above is that pass.

The one known gap is colour: the white field with no visible border on the grey page is 1.17:1 against the 3:1 that WCAG 1.4.11 asks for. It is listed in the Opening with the other brand failures, and pinned by a test.

A second known gap is how a screen reader counts the popup. VoiceOver counts the groups as the items, so it reads "2 items" for a popup of four recent and five popular searches. I moved a hidden label out of the list, which had made it say 3, and put each group and its size into the list's spoken name, so the real counts are still read out. The popup works and nothing is blocked, but "2 items" is confusing. A cleaner fix is on the [roadmap](./roadmap.md).

**How it works: the no-results flow**

A submitted search (Enter, a suggestion, a pill or a recent search) sends two separate requests, and neither waits for the other:

1. **The search itself**, `POST /search/index` (section 3). It fills the page with results. When it returns a count of 0, the page shows the no-results message and emits `search_zero_results`. The term isn't saved to Recent searches.
2. **The log entry**, `POST /searches` (section 1). It records the term for popular searches and Insights. The server counts the term itself, without any filters, and records it whether the result is zero or not. That is how a zero-result term gets recorded.
3. Insights (section 6) later reads those records, so `VSG` shows up as a term users searched that never returned anything.

A refinement (a change of filter or sort) is different. It only sends search requests to update the results and counts, and it never sends a log entry. Only searches are logged, so popular searches and Insights reflect what users look for, not how they slice the results.

I count the term without filters on purpose. If the page's own count were used, a valid term with a restrictive filter applied would look like a product gap.

**Why this way**

*In one sentence:* the combobox follows a published pattern so keyboard and screen reader users get the same suggestions as other users, and the server counts zero results itself so the product-gap signal stays honest.

- *Benefits.* A standard pattern means assistive technology already knows what to do with it. A single `search_zero_results` event plus a server-computed count means the business sees real gaps and not artefacts of filters.
- *Alternatives I rejected.* A plain input with a dropdown, which would have left keyboard and screen reader users without announcements. Counting zero results in the browser and reporting them, which can be wrong or faked. Storing the applied filters with each log record, which the AI reviewer suggested, and which I replaced with the simpler unfiltered count.
- *Costs.* The combobox contract is a lot to specify and test. The count adds one extra search on the server per distinct spelling, though it is remembered after the first.
- *What changed along the way.* My first test plan only said "keyboard flow". I meant the full keyboard behaviour that WCAG and the ARIA combobox pattern define, but the AI reviewer read it literally and said it was too narrow. I decided to stop leaving it implied and wrote the whole contract above down, so it is specified and tested. I decided on the server-side unfiltered count after the AI reviewer showed that filter-induced zero results would be reported as product gaps.

**UI choices and why**

- The field is a single full-width white input with a 5px radius, 48px tall on phones and 62px from desktop. The Search button sits inside it at the right end with the clear button to its left.
- The console logs three events: `search_submitted`, `search_zero_results` and `suggestion_selected`. Refinements (filters, sort) emit none of them (section 1). The events are display only, because the server's search log is the source of truth. They show what a production build would measure.

*Talking point:* a real build would move the log into an analytics pipeline for a daily product-gap report ("123 users searched `VSG`, 0 results"), which is also where "did you mean" would come from.

## 3. Search results and pagination

**The brief asked for:** results dynamically below the bar, relevant information per result, and pagination.

**The problem to solve:** the original API sends full documents for every page, so the same instrument is downloaded again for each search, suggestion and recent search it appears in. Counts and order also depend on whichever pages the browser happens to hold. The flows below show the result. The reasoning follows.

**Demo flows**

- *Good flow.* Search `vanguard` (31 results). Each row shows logo, ticker, name, type, issuer, the Betashares, Flagship and Auto Invest badges where they apply, and for shares "N units on issue". That is all the data holds (see the assumptions in the Opening), and I didn't invent fields.
  - Click **Load more**. Skeleton rows appear below the existing results, then fill in, and the button keeps its size. Focus moves to the first new row, and a screen reader hears "16 more loaded, showing 31 of 31". The single leftover row is merged into this batch (`orphanSize`), so the button becomes an end-of-results message.
  - With the Network tab open, the click sends a request only for the instruments the page doesn't already have.
- *Bad flow: a missing logo.* Search `ELV`. The default placeholder logo shows, and the page doesn't break.

**How it works: loading more without downloading everything**

I split the search in two. The server answers "which instruments match, and in what order" with a short list of IDs, and the page fetches "what each instrument is" separately. Searching by IDs first is called ID-first search, and filling the ID list in with full documents is called hydration.

1. A search calls the new `POST /search/index`. The server filters and sorts the whole match set and returns the true count, the counts for all seven filters, the first 500 matching IDs in sort order (the maximum IDs per search, `idLimit`, which can't go above 1,000 because the API won't return more in one request), and the first 15 full documents (`documentLimit`). First paint takes one request.
2. The page keeps every document it receives in a store keyed by ID. Instrument data is static, so each one is fetched once for the session.
3. Load more takes the next 15 IDs and checks the store. Only the missing ones are fetched, from the new `POST /instruments/batch`. Often that is zero requests.
4. With more than 500 matches (an empty search matches all 834 instruments), the page asks for just the next 500 IDs. The count and filter counts are the same for the same search, so they aren't fetched again.
5. Repeating a search seen before (same term, filters and sort) comes from cache with no request.
6. Changing a filter or sort goes back to step 1. Any instrument already in the store appears instantly.

The windows and batches are separate requests, so the data can change between them, for example when the API restarts on new data. Joining IDs from two datasets would show wrong results. To prevent that, I made every response carry `indexed_at`, the time the API loaded its data, otherwise known as a snapshot token. The page sends it back with every follow-up request. If it no longer matches, the server answers `409` with the current value. The page then drops its caches and reloads the first batch in place.

I chose 409 on purpose, as a data-consistency choice and not a security one. The request is valid, so 400 (malformed request) would be wrong. It is only stale, because it names a snapshot the server no longer holds, and 409 Conflict means the request conflicts with the current state of the resource. It also tells the client how to recover: refresh, using the current `indexed_at` in the response. 410 Gone implies the data was removed for good, when here it was replaced. 412 Precondition Failed is the standard code when the version check uses conditional headers (`If-Match` with an ETag). My snapshot travels in the JSON body, so 409 fits better, and if the token moved into a header, 412 would be the stricter choice. `GET /version` returns just the current value, so the page can spot a restart without running a search (when it asks is in section 5). Responses that arrive after a reset are discarded.

The page never filters, sorts or counts anything itself. Order and counts always come from the server.

**Why this way**

*In one sentence:* the server answers with IDs only, so each instrument is downloaded once and the counts stay right at any scale, at the cost of a bit more machinery in the page and two new endpoints.

- *Benefits.* Each response is small and bounded: a window of short IDs plus at most one batch of documents, whatever the size of the catalogue. Nothing is downloaded twice, because the same instrument appears in results, suggestions and recent searches and is fetched once. Changing a filter or sort costs one small request. Counts stay correct at any scale, because they never depend on what the browser has loaded.
- *Ready for live prices.* Static data (name, logo, issuer) is cached once by ID. Prices would be a separate live layer keyed by ID: the page knows exactly which IDs are on screen, subscribes to just those, and every view of an instrument updates from one place. If documents were copied into each search response instead, a price would be stale on arrival and refreshing it would mean re-running whole searches.
- *Ready for other content.* Nothing in the store, the planner or the rows depends on what an instrument is. They work on IDs and documents, so searching documents or page content means a new adapter behind the same seams, with minor tweaks.
- *Ready for more markets.* IDs are already market-qualified (`VAS:AU`), so `SPY:US` slots in. If each market's data sits in its own service, `/instruments/batch` is the one place that fans out, and search doesn't change.
- *Alternatives I rejected.*
  - Caching whole responses instead of instruments: the server pages full documents, as the original `/search` does, and the browser caches each response. It is the simplest, but the same instrument is copied into every response it appears in, so it is downloaded again for each search and the server sends the same documents repeatedly. Live prices can't be cached, and in a bundled response they would sit beside the static parts, so the static parts couldn't be cached on their own either. There is also no single place to update an instrument. What I built caches the static parts of each instrument once, by ID, and leaves live data as a separate layer.
  - The browser fetches the whole match set for a term and filters and sorts it. The payload grows with the match count, an empty search downloads the whole catalogue, and the page would have to rebuild the API's ranking, sorting and filter counts.
  - The browser works out the filter counts from per-instrument attributes. That is only right if it holds every match, which stops being true once IDs are windowed.
- *Costs.* It needs two new endpoints and a store with planning logic in the page. Later batches can cost a second request. Documents are about 400 bytes today, so the byte savings are modest at 834 instruments, and the case rests on scale, live prices and more markets. The snapshot token only covers the version of the loaded data, which is enough for a mock that changes on restart. A live feed would need more.
- *What changed along the way.* The plan went through five rounds of adversarial review by a second model before any code, and it found real flaws in this design:
  - Windows of IDs could duplicate or skip records if the data changed between requests. I decided to return `indexed_at` as a snapshot token and require it on every later window. That is where the token and `GET /version` come from.
  - A restarted API could serve new data while the browser kept old IDs and documents for good. I decided to include `indexed_at` in every cache key and clear everything when it changes.
  - The first draft of `/search/index` reused the old pagination fields (`from` and `size`), which clashed with ID windows. I gave it its own fields (`id_offset`, `id_limit`, `document_limit`) and made it reject the old ones with a `400`.
  - Equal sort values had no guaranteed order, so a window boundary could be ambiguous. I decided to add a final `symbol_openfigi` tie-break on the new endpoint: a last sort key, so equal values always come back in the same order.
  - The old `search()` paginated before returning, so it couldn't give a full ordered list. I decided to add a new internal `searchAll()`, rebuild `search()` on top of it and pin the old behaviour with baseline tests.
- *A challenge I kept.* During the plan review, the AI reviewer argued this design was over-built for 834 static records. They suggested using the existing paged `/search` for the first version and presenting ID-first as a future step. I kept ID-first on purpose, and this was a judgement about the product, not the dataset. At 834 records the simpler way works. But a real Betashares page might not stay static: live prices would arrive, and more markets would join the ASX. ID-first fits both. A price becomes a live layer keyed by ID that updates every view of an instrument from one place, and a new market slots in behind `/instruments/batch` while search stays the same. Building the simple version first would mean reworking the data flow the moment either arrived. So I paid the extra machinery now and stated its cost above, because choosing a design for where the product is going, and being honest about what it costs today, is the decision I wanted this project to show.

**UI choices and why**

- Load more, not numbered pages and not infinite scroll. Earlier results stay in view while you scan, and the button keeps you in control and the footer reachable. The focus move and announcement in the flow above cover load more's usual accessibility gap.
- A batch is appended only when every document in it has arrived, so the list never shows a half-filled batch.
- A tail of 3 or fewer results (`orphanSize`) merges into the batch before it. 18 results show at once and 19 show as 15 then 4, so no user clicks a button for one or two rows.
- A new search or refinement cancels any load in flight. If a batch fails, the rows stay and the major failure message (section 5) with its Retry button replaces the load button.
- IDs the batch endpoint reports as missing are skipped and logged to the console, so one bad ID doesn't break the page.
- After a `409`, focus moves to the results heading and the live region says "Results were refreshed". Without that, a screen reader user wouldn't know the list had changed.
- Rows are full width, not a card grid. Instruments are scanned by ticker and name, and long fund names fit without truncating. They aren't clickable, because the brief asks for no detail view and a link to nowhere is worse than none.
- A missing or broken logo falls back to a default image (`onError`), and logos load with `referrerPolicy="no-referrer"`, so the page never shows a broken image.
- One label per instrument type, from one source: "Shares (equities)" and "ETFs" in the filter and chips, "Share (equity)" and "ETF" on a row (#41). Before, the same type had two names. The plain word comes first and the precise term sits in brackets, so users new to investing learn the word they'll meet elsewhere.

## 4. Filters and ordering

**The brief asked for:** options to filter and re-order results.

**The problem to solve:** filters are only useful if they steer you away from dead ends. Showing a count beside each option does that, but the counts have to stay right as you tick things, at any catalogue size. The original `/facets/:key` returns one filter's counts per call, and it works by running a whole search for every option value. For seven filters, ticking one box could mean hundreds of searches. And a browser that only holds a window of results can't work out counts for itself.

**Demo flows**

- *Good flow.* Clear the search. Tick **Type: ETFs**. Results update and every other count updates with them. Tick **Issuer: Vanguard**, then **BlackRock**. Results show both issuers (OR within a section), narrowed by ETFs (AND across sections).
  - Tick the two issuers quickly: the first results request is cancelled and one set of results shows. While results load, the previous ones stay on screen, dimmed.
  - Toggle **Available for Auto Invest**. Results now carry all three refinements. Options that would give zero results show disabled, not hidden.
- *Good flow: sort.* Change Sort to **Investment name A – Z**. The order changes and the list resets to the first batch. Run a new search and the sort stays.
- *Good flow: chips.* Applied filters show as chips above the results. Click one to remove it, or use **Clear filters**, which leaves the term and sort alone.
- *Good flow: responsive.* Open the device toolbar at about 375px (mobile, 0 to 759px). It is one column, the popular pills stay on one line (the ones that don't fit are hidden), and **Filters** and **Sort** sit above the results.
  - Tap **Filters** and tick two options. The counts and the "Show X results" button update, and the results behind don't.
  - Close with ×. The changes are discarded. Reopen, tick again and press **Show X results**: the drawer closes and the results apply.
  - Tick a filter in the drawer, close it, then run a new search. The pending ticks are discarded, and so are the applied filters. The sort stays.
  - Widen to about 900px (tablet, 760 to 1029px), then about 1300px (desktop, 1030px and up). There are two columns: a 260px filter rail and the results. On desktop the content caps at 1030px and centres. Ticking a filter updates the results directly, with no button.
- *Bad flow: a filter that drops things.* Untick ETFs and pick a **Shares issued** range. Only shares remain, as the "(equities only)" label warns.
- *Bad flow: filters and a new term.* With **ETFs** ticked, search a different term (a pill or recent search counts too). The applied filters clear and the sort stays. The issuer and units options depend on the term, so carried-over filters could turn a new search into zero results. I changed this in #20, from "keeps the applied filters". Because disabled options stop ticking from reaching zero results either, there are no "Try removing" chips: they were planned, then I dropped them in #20 once filtered zero results stopped happening.
- *Bad flow: missing values in sort.* Sort by **Shares issued high – low**: 459 of the 834 instruments have no value (456 ETFs and 3 shares), so they go last, as the help text says.

**How it works: counts that stay right**

Each filter section and its options with counts is called a facet. The server computes all of them.

1. `POST /search/index` returns the counts for all seven facets with the results. Each section's options come from the whole catalogue, not only the matches, so an option with no matches comes back with `count: 0` and the page can show it disabled.
2. A count answers "how many results if only this option were selected in its section, with every other section's selection and the search text applied?". So a section's own selection never hides its siblings: ticking Vanguard doesn't make BlackRock's count disappear. Sections combine with AND and options within a section with OR. This is sometimes called disjunctive counting.
3. The server does it in one pass for the filtered set, plus one more pass for each facet you are actually filtering on. It does not run a search per option.
4. When you tick a box, the page sends a counts-only request. It asks for `include: ["count", "facets"]`, so no IDs or documents are computed. The request is keyed by the full pending state, and a response for a state that has since changed is discarded, so a slow reply can't overwrite newer counts.
5. On tablet and desktop the results update at once, with no button. On a phone, ticks edit a pending set in the drawer, and the **Show X results** button applies them. The live count on that button shows what you'll get before you commit.
6. Sort runs on the server too, with a final `symbol_openfigi` tie-break on the new endpoint only, so equal values come back in a fixed order and Load more never repeats or skips a row. The original `/search` keeps its ordering.
7. Search state (term, applied filters, sort) is one plain object, built into one canonical request. The same object is the request body and the cache key, with sorted keys and values, so a state you've seen before costs no request.

**Why this way**

*In one sentence:* the server counts everything over the full match set in one pass, so the counts stay right and you never see an option that leads nowhere, at the cost of a request while you tick and two behaviours (live and button) to build and test.

- *Benefits.* Counts are right at any scale, because they never depend on what the browser holds. One request gives the whole rail. Disabling zero-count options stops dead ends, and showing them disabled instead of hiding them stops the list jumping. A selected option is never disabled, so no user gets trapped by their own choice.
- *Alternatives I rejected.*
  - Counting in the browser. It is only right if the browser holds every match, which stops being true once IDs are windowed.
  - Reusing the original `FacetsService` per value. It would run hundreds of full searches per request.
  - Waiting for an Apply to show any counts. Then there is no live total on the button.
  - Merging look-alike issuers or editing the data. Guessing wrongly could hide or mix results.
- *Costs.* On desktop each change sends a counts request and a results request for the same state. Putting facets in the results request would remove the extra one. Live and button modes mean two behaviours to test. The overlapping unit ranges are the API's own behaviour (below).
- *What changed along the way.*
  - **Button, then live.** I first decided filters apply on a button everywhere ([ADR 0003](./adr/0003-refinements-apply-on-button.md)), with live counts, to avoid fetching results the user never looks at while still deciding. The AI reviewer argued the opposite, that live-apply was simpler, and I kept the button. In my own review of the built page, the rail's apply button sat at the bottom of a tall column and got missed, and when I made it sticky it covered rows and hid that the list carried on. Moving it to the top would only move the problem. The research splits by device: Baymard (2026) treats live updates as expected on desktop and a button with a live count as right on mobile, and Maersk's design system uses live updates when results come back in under a second, which ours do. So I changed tablet and desktop to apply as you tick, and the phone drawer keeps its button ([ADR 0004](./adr/0004-live-filters-on-tablet-and-desktop.md)). The AI reviewer was partly right.
  - **Count rule.** The AI reviewer noted my plan never said what a count meant for a multi-select. I decided on the disjunctive rule above and pinned it with truth-table tests.
  - **Selected options.** The AI reviewer found that disabling a zero-count option could trap a user who had ticked it. I decided selected options always stay removable.
  - **Overlapping ranges.** The AI reviewer found the units buckets share edges, so a value exactly on an edge counts in two. I kept the API's edges as they are, because the page shows data as given. No instrument currently sits on an edge, and a test asserts that.
- *A challenge I kept.* Two, both from the plan review.
  - The AI reviewer said "all seven facets" mistakes what the API can do for what users need, and suggested shipping type, issuer and perhaps two flags. I kept all seven because each is a real filter on this data and the brief asks for filtering. The server computes all seven in one pass, so the extra filters cost little, and the Betashares-specific ones (Flagship, Auto Invest, Betashares funds only) are what this business would want first.
  - The AI reviewer also said that keeping search state out of the URL means a refresh loses the search, back and forward can't restore it, and you can't share a link to a search. I kept state in React: sharing and bookmarking aren't in the brief, and it keeps the URL clean and avoids history handling. The cost is real and I'd say so if asked. It is also cheap to reverse: the whole search state is already one canonical object (it is the request body and the cache key), so writing it to the URL later is a small change, not a redesign.

**UI choices and why**

- The filter order is meant to suit the business and the users searching (#39). Betashares' own products come first: Betashares funds only, Flagship funds and Available for Auto Invest. Flagship and Auto Invest only cover Betashares funds in the data. Then come the filters most users reach for, Type and Issuer, then Portfolio eligible only, and **Shares issued (equities only)** last. The order of the last four is a judgement call with no usage data behind it. Portfolio eligible only started at the very bottom and I moved it up one place during PR review, because a lone toggle at the end of a tall rail gets missed.
- Issuer shows the top 8 by count (`featuredIssuers` in config), then **Show all** with a filter box. A long list of issuers would push the other filters off the screen.
- The issuer label is for display only. "Investors Mutual" shows, but the value sent is the raw identifier, called a slug (`investors_mutual`). Labels come from a casing override map, else title case. The page never merges look-alike slugs, and when two give the same label it shows the slug as a hint.
- **Shares issued (equities only)** is a single-select set of ranges, labelled that way because ETFs have no units and the range would silently drop them. Raw field names like `is_portfolio_excluded` are reframed ("Portfolio eligible only") because the raw flags are confusing.
- The apply button reads "Show 1 result", "Show 31 results" or a disabled "No matching results", and keeps its width while counts load.
- Applied-filter chips are small buttons named "Remove <label>". They sit above the results and wrap onto new lines at every width, and a long label is cut with an ellipsis. The rail and drawer have their own Clear filters for ticks that aren't applied yet.
- Sort sits in the results header, apart from the filters, because it changes how results are shown and not which ones. It persists across searches and has no reset button: picking **Best match** (the API's own default order) is the reset.
- Sort options are Best match, ASX code (ticker) A – Z and Z – A, Investment name A – Z and Z – A, and Shares issued high – low and low – high. There is no issuer sort, because the API sorts on slugs and the filter covers it.
- Built mobile first. The breakpoints are mobileLarge 560, tablet 760, tabletLarge 895, desktop 1030, desktopLarge 1200 and desktopXLarge 1400, and nothing overflows down to 360px wide.

## 5. Loading states

**The brief asked for:** loading or skeleton states.

**The problem to solve:** a search page makes many requests, and any of them can be slow, fail, or arrive after a newer one. Without care, that shows as a blank page, a layout that jumps, or old results overwriting new ones. It is also good UX to give the user feedback whenever the app is working in the background. With none, a slow request looks like the app is broken or has hung.

**Demo flows**

- *Good flow.* Reload the page: skeleton rows, then results. Load more shows skeleton rows too, and nothing changes size or shifts while they load.
- *Good flow: new search.* Tick a filter. The old results stay on screen, dimmed, until the new ones arrive, so the page never goes blank. A new search or a sort change shows skeleton rows.
- *Bad flow: the API is down.* Stop the mock API, then search. The message "The app seems to be experiencing issues" with a **Retry** button shows, not a blank page. The search box, term, filters and sort stay. On tablet and desktop the filter rail shows the same message too, because its counts failed as well. Restart the API and click Retry on each: the results load, then the filters return. The error takes a few seconds to appear, because the page retries quietly first (item 4 below).

**How it works**

The data layer is TanStack Query, which handles typeahead races, cancelling stale requests, keeping the previous results visible while a filter change loads, and caching.

1. Each search state is one canonical request that is also the cache key (section 4), so a response for a state the user has left is dropped.
2. Skeleton rows match the real row dimensions, and the Load more and apply buttons keep a fixed size with a spinner inside, so nothing shifts. The first batch of documents comes inside the search response (section 3), so no second request sits between the skeleton and the first rows. How a failed Load more is handled is told in section 3.
3. Static search and document queries never go stale. That would be wrong after an API restart, so I made the page also ask `GET /version` on load, on window focus and on reconnect (10 minute freshness, `versionStaleTimeMs`), and clear everything if the data version changed.
   - It never checks on a timer, only when a user returns to the page or the network reconnects, and only if the last check is older than the freshness time.
   - A user who stays on the page for 20 minutes is never asked.
   - A user who leaves the tab and comes back is asked only if the last check was 10 or more minutes ago. If it was 3 minutes ago, the page skips the check.
   - A user who loads the page, stays 20 minutes, switches tabs and comes straight back is asked, because the last check (the page load) is over 10 minutes old, even though they were never away long.
   - If the data timestamp changed, the page clears what it kept and loads fresh results. If not, it keeps what it has.
4. Every API call goes through one function, the gateway (section 6), which handles the timeout, the retries and the failure report.
   - Each attempt has a 5 second timeout (`apiTimeoutMs`). Network errors, timeouts and server errors are retried up to 3 more times (`apiRetries`), waiting 250, 500 and then 1000 milliseconds (`apiRetryBaseMs`). One outage therefore gives a few quick retries before the error and Retry button show, and the worst case is about 22 seconds.
   - A client error such as the 409 in section 3 is never retried, because the page needs it straight away. A request the page cancelled is neither retried nor reported.
   - Only after the last attempt fails does it report the failure, once, to the console and the Data problems panel (section 6).
5. I marked each caller as major or minor in that one function. The major callers are `search-index` (first batch, refinements, the restart after a 409 and the filter counts) and `instruments-batch` (Load more), because the page can't show results without them. Every other caller is minor and shows nothing new. When a major call fails for good, the page shows one message, "The app seems to be experiencing issues" with "Try again in a moment." and a Retry button, and reports `major_failure` once ([ADR 0007](./adr/0007-one-message-for-major-api-failures.md)). The button keeps its size, spins and is disabled while it runs. The header, search box and sort always stay. Where the message shows depends on what is on screen:
   - *Nothing to keep* (the first batch or a refinement fails): it replaces the results.
   - *Rows showing* (Load more or the restart fails): the rows stay and it sits under them in place of the Load more button.
   - *Only the filter counts fail*: the filter panel (rail or drawer) shows only the message. The options, Clear filters and, on phones, the drawer's apply button are hidden until a Retry works. The results are untouched.

**Why this way**

*In one sentence:* one library handles requests, cancellation and caching, so the loading states are a consequence of the data layer and not hand-written special cases.

- *Benefits.* Fewer places for race bugs, and no layout shift on any state change.
- *One message with Retry.* Once the gateway has given up, its retries have already covered any blip of a few seconds, so something major has happened, and users see the same words wherever the message shows. Retry stays because the retries cover seconds and an outage can last minutes: without it the only way back is a reload, which loses the term and filters. I dropped "Check your connection", because in production most outages are on the server side and it would blame users for a fault that isn't theirs. The filter counts are major because they come from the same request as the results, so if they fail the results almost certainly fail too.
- *Alternatives I rejected.*
  - A hand-rolled `fetch` hook, which has more bug surface and no visible gain. SWR, whose pagination support is weaker. RTK Query, which needs Redux. Apollo or urql, which are for GraphQL, and this API is REST. TanStack Query is transport-agnostic, so it would also fit a GraphQL stack.
  - A full-page message for every failure. It loses the typed term, filters and sort, and says the whole app is down while the header and search still work.
  - Replacing loaded rows when the next batch fails. That destroys content that works.
  - A limit on manual retries. It is a courtesy and not protection: each Retry already runs the gateway's attempts with the button disabled, a reload resets any count kept in the browser, and real protection is rate limiting on the server.
- *Costs.* A dependency, and the discipline of putting every response-shaping value in the query key. Forever-fresh caching needs the version check above. Each new endpoint call has to be marked major or minor when it is added.
- *What changed along the way.* I found that one outage gave 4 search calls and 4 error reports in about 7 seconds, because TanStack Query's default retries re-ran the whole search request and its error report each time. I changed it so the one function above is the only place that retries, and turned the others off. The AI reviewer pointed out that `staleTime: Infinity` means a repeated search makes no request, so it would never learn that the API had restarted. I decided to add the `/version` check, with its 10 minute freshness. The AI reviewer also found that failures during load more weren't defined, so I decided a batch is atomic (section 3). One outage had also shown in two Data problems rows with three counts, and with different wording in each spot, so I decided on one message wherever a major failure shows and one Data problems row for it ([ADR 0007](./adr/0007-one-message-for-major-api-failures.md)).

**UI choices and why**

- Skeleton rows use the canvas colour as their base so they show on a white card.
- The end of the list gets a plain message so no user wonders whether more is coming.

## 6. Added because I judged it necessary

None of this was in the brief. Each item below says what it is, why I added it, and what it costs.

**One API gateway.** I made sure the gateway function does the retries and the error tracking, so every API call gets both and nothing else has to. I wanted one universal gateway that handles it all, in one place and DRY: a new endpoint needs only a caller name to get the timeout, the retries (section 5) and the report to the console and the Data problems panel below. Each caller is also marked major or minor there, which decides whether the page shows its failure message (section 5). The cost is that it is one function everything depends on, so I tested it directly and set the retry count, backoff and timeout in `config.ts` ([ADR 0006](./adr/0006-one-api-gateway-for-retries-and-errors.md)).

**Insights panel.** Gear → Insights. `VSG` from section 2 is listed under zero-result terms, grouped by dedupe key, with the total and each spelling counted. Search `vsg ` again and reopen the panel: it is the same group and the count ticks up. Popular searches come from the same server log. This is the view a product owner would get from an analytics pipeline.
- *How it works.* It reads `GET /insights/zero-results`, which lists a term when no spelling of it has ever returned results and at least 2 different clients searched it. That cuts one-off noise. The route only exists when the API starts with `ENABLE_INSIGHTS=true`, and otherwise answers `404`.
- *Why.* Zero-result terms are the clearest product-gap signal the log can give. Insights show what users search for, which can include sensitive text. The AI reviewer asked why an unauthenticated screen exposes other users' searches. The answer is that here it is shown only in a development build, behind a flag on the API and labelled, and a real build puts it behind admin login. The 2-client threshold reduces noise and is not anonymisation.

**Data problems panel (#31).** The Insights panel has a second section next to zero-result terms: counts of the problems the page runs into while showing data:
- major failures (a call the page can't show results without failed for good, so the issues message showed)
- batches that reported missing IDs
- incomplete batch responses
- other (minor) API calls that failed, after the retries in section 5
- logos that failed to load
- instruments with no display name

Logos and display names are counted once per instrument. A stale snapshot (a normal reload) and a response discarded because it arrived late are counted but not shown, since neither is a fault. Every one of these, shown or not, also prints to the console as a warning or error when it happens, with the `[analytics]` prefix. The counts live in memory for the session and nothing is sent anywhere. It isn't a telemetry system. A failed API call goes to the console and to this panel once, which stands in for error tracking: a real build would send the same report to a service. It shows where error reporting would plug in, next to the repeated user issues from zero-result insights.

**Problems in the mock data.** The problems and how I handled them are in the Opening. To see them in the page: Gear → Settings → turn on **Show raw data**, then search `etf`. Two issuers look the same, `etfshares` (WWWW) and `etf_shares` (HUGE, BEST), and the raw value tells them apart.

**Settings tab and Show raw data.** Gear → Settings. These are the values that change how the app behaves. Every value in `config.ts` is here except one: the setting that keeps search results from ever going stale. Page size and the minimum characters were judgement calls, so the tab lets you try other values and see the trade-off. The fields are grouped:
- *Results.* **Results per load** is how many results the first batch and each Load more bring in. **Orphan size** joins a final page that small onto the page before it, so the list never ends on a tiny page. **Maximum IDs per search** is the most matching instruments, in sort order, that one search request will list. It defaults to 500, about 33 loads at 15 a load, and can't go above 1,000 because that is the most the API returns in one request. **Skeleton rows while loading results** is how many grey placeholder rows (skeletons) show in the list while a new search loads, and **Issuers shown before "Show all"** is how many issuers the filter lists first. **Version timestamp check interval** is how long the app trusts its last check of the data timestamp. The check never runs on a timer, only when a user comes back to the page or the network reconnects, and only if the last check is older than this. A user who stays on the page is never asked. If the timestamp has changed, the page clears what it kept and loads fresh results, otherwise it keeps them. **Show raw data** prints the values exactly as the API sends them.
- *Suggestions.* **Suggestion minimum characters** is how many characters you type before the app asks the API for suggestions. **Issuer suggestions shown** is how many issuer searches are listed above the matching instruments. **Suggestion delay** is how long typing must pause before it asks. **Skeleton rows while loading suggestions** is how many grey placeholder rows show in the suggestion list on the first lookup.
- *Popular and recent searches.* The three **Popular pills** fields set how many show on phones, tablets and desktops, and **Maximum popular pills on any screen** is the ceiling for all three. **Keep popular pills on one line** hides pills that don't fit instead of wrapping them. **Popular searches in the search box** is how many are listed under your recent searches when you click the empty box. **Remember recent searches** switches the history on or off, and **Recent searches kept** is how many it holds.
- *API.* **API address** is where the app sends its requests. **API retries**, **First retry wait** and **API timeout** are the gateway settings from the first item in this section.

To see what a setting does:
- Set **Suggestion minimum characters** to 1, then type `vanguard` with Network open. Suggestion requests start from the first character. Reset to defaults and type again: they start only from the third.
- Set **Results per load** to 5 and load more. It adds 5 at a time, "Showing 5 of ...".
- Turn on **Show raw data** and search `investors`. Grey raw values appear beside the labels (`Investors Mutual` *investors_mutual*) and each row shows its ID. Two issuer options look alike, because the data has `investors_mutual` and `investors mutual`, shown as given.

- *How it works.* The tunables live in the one config file (see the Opening), and the panel uses their descriptions as help text. **Save and reload**, in the panel footer, saves the values to localStorage and reloads the page, and only values that differ from the default are stored. One small `RawHint` component prints the raw value beside a label wherever it appears, is off by default and renders nothing when off.
- *Why.* It lets a reviewer see exactly what the API sends next to what the user sees, and it makes the data problems above visible instead of buried.
- The same panel has **Restore demo popular searches**, which calls `POST /search-log/restore-seed`. It exists so I can reset the demo to a known state without restarting the API or editing the log file. The API also has `DELETE /search-log`, which empties the log. I built it together with a Clear popular searches button, then removed the button, because the demo only ever needs the seed back. I kept the route in case it is needed again, and nothing calls it now. Both routes share the `ENABLE_INSIGHTS` flag, because anyone who can reach them can wipe the log. Restore builds the seed first, so if counting fails the old history stays.

**Header and gear.** The header scrolls with the page, and nothing on the page is sticky (#17). Sticky bars cover rows and hide that the list carries on. The gear is there for this demo only, and the build mode decides whether it shows, not a setting. It opens the Insights tab (searches that found nothing, and data problems) and the Settings tab. A production version of the page wouldn't have the gear at all.

**Theme and accessibility audit.** The look comes from the live Betashares fund page: colours, sizes, radii and fonts read from its computed styles by script, not estimated from screenshots (#21). The page was built first on Chakra's default theme with design tokens only (named colours and sizes in the theme, no hard-coded values), so the Betashares theme landed as configuration with no component edits.
- *Brand first, then accessibility.* I matched the brand exactly first and the failures it carries are listed, with the reason I kept them, in the Opening ([ADR 0005](./adr/0005-match-brand-then-fix-wcag.md)).
- *Corrections to the automated extraction.* `DESIGN.md` is the source of truth for the look. It corrects the automated brand extraction, which used an emoji font as body text, had invisible borders and failing contrast, used a WordPress default palette, contradicted itself on radii, and inverted the page canvas. Inputs are 5px, buttons pill, cards 15px (30px from desktop).
- *Fonts.* Rund Text and Rund Display are hotlinked from betashares.com.au and never committed, with Inter as the fallback. Two AI reviewers flagged the licence and availability risk. It is a non-commercial POC for Betashares, who use these fonts on their own site, and I decided to keep them. The files aren't redistributed, and Inter covers a slow or unreachable host.
- *A one-off audit.* An automated browser audit of the running app (a one-off check, not a test dependency) found no other failing text colour.

**Security.** Anything that reaches every user is an attack surface, so the new endpoints reject unknown fields, bad values, malformed IDs, more than 100 IDs in a batch, request bodies over 32KB and very long terms, with a `400`. CORS stays the existing global development policy: it is not a security boundary, scripts ignore it, and claiming an origin allowlist would be a false security claim. User text is always rendered as text, with no `dangerouslySetInnerHTML`, because logged terms are shown back in insights. `npm audit` is clean in both packages. Rate limits and the log bounds are in section 1.

**Tests.** Everything runs from one `npm test`, assuming reviewers have no AI tooling and no browser tooling.
- Before changing the API I wrote baseline tests for the original behaviour, quirks included (for example `from: 0` is treated as page 1), so the additive changes are proven not to break it.
- Contract tests start the real API as a child process on a spare port and run the page's real client against it, which catches request and response drift that mocked tests can't.
- Component tests (in a simulated browser) cover the combobox keyboard and ARIA contract with jest-axe, the filter flow with stale counts ignored, load-more focus and announcements, failures, and the `409` restart.
- *Why no browser end-to-end suite.* Both of the plan's AI reviewers asked for one. I explored Playwright and rejected it, because its browser downloads add hundreds of megabytes for one flow. The risks it would catch (contract drift, CORS, focus, timing) are covered inside `npm test`, and the CORS preflight is covered with an in-process request. Visual layout and a real screen reader stay manual, using the demo flows.
- One-command setup and run: `npm run setup` installs both packages and `npm run dev` runs both, using a small script built on Node's own `child_process`, so no process-runner dependency.

## Close

- One picture: components, query hooks, the document store, the API (see the [README architecture](../README.md#architecture)).
- Four decisions to land: ID-first search, the version stamp (snapshot token) for consistency, server-side logging so counts can't be faked, and a design built to be reused and to scale.
- **How the work was run.** I spent a working day (about 7.5 hours) with Claude planning and architecting the system before I wrote any code, using a one-question-at-a-time interview against the project's domain docs until each decision was locked. The terms went into a glossary (`CONTEXT.md`) so the code, docs and UI use the same words. The decisions went into the plan, and the few that were hard to reverse, surprising and a real trade-off became ADRs with the options I rejected. A second LLM, Codex, then reviewed the plan adversarially over five rounds, looking for gaps and oversights. Where we disagreed I made the call: keep ID-first search, keep all seven filters, and skip a browser end-to-end suite. The locked plan became three milestones and 25 GitHub issues, each with acceptance criteria and built on its own branch. Codex reviewed every change before its pull request, and I tested each one in the running page before I merged it. I often found problems, and fixing those is where the code drifted from the documents. The hard parts were keeping results consistent while the data can change underneath them, counting every search without breaking the cache, and making API failures behave the same way everywhere. I made every decision and merged every pull request myself.
- **How the code is written.** The rule was the smallest change that fully solves the problem, and YAGNI: I didn't build for a need I couldn't show. Where I weighed an optimisation and judged it not yet worth its cost, I left a comment in the code with what I weighed and what to change if it ever matters. I labelled those comments `shortcut:`, which undersells them: each one is a call I made, not a corner I cut. Search the code for `shortcut:` to find them. The search log's eviction scan is one: it checks every key, and a heap would replace it if inserts got hot. I built test-first for much of the work: the failing test, then the code. Before I changed the existing backend I pinned its behaviour with baseline tests, so every change to it was checked against what it did before, and the new endpoints are strict. Each thing lives in one place: one API gateway for retries, timeout and error reports, one config file for every tunable (its descriptions double as the Settings help text), and one canonical request that is both the request body and the cache key. The UI reaches data only through interfaces, so the data source can change without touching it, and the planning logic is a pure function that is easy to test. Tests run at three levels: unit, component, and contract tests against the real API, with accessibility checks. Styling uses design tokens only, so the Betashares theme went in as configuration.
- **Decisions on record.** The plan holds every decision, with dated notes when one changed. An ADR is for the few that were hard to reverse, surprising without context and a real trade-off, and it lists the options I rejected. ADR 0005 reverses a line in an earlier ticket, and says so.
- **Not built, on purpose.** A real analytics pipeline, admin login on insights, a proper way to identify users, a database for the search log, a dedicated `/suggest` endpoint, "did you mean" for typos, a detail page, and prices (not in the data). The [roadmap](./roadmap.md) has the full list.

---

Reference half. Each decision here is told in full in the section it belongs to; entries below point back to it, and keep the full reasoning only where no section tells it.

## Data architecture: ID-first search with hydration

**Principle:** load only what's needed, when it's needed. Search answers *which* instruments match and in what order; a separate store holds *what* each instrument is. The frontend never filters, sorts or counts. Told in full in section 3 (How it works, and Why this way). Full record: [ADR 0001](./adr/0001-id-first-search-with-hydration.md).

### Trade-offs, stated plainly

Most trade-offs are in section 3 (Costs) and the Opening (why extend the API). The strict new endpoints against the lenient originals are in Decisions (Stack). One is not told anywhere else:

- Price sort (future) would be a server snapshot: prices tick in place without rows jumping, and the order refreshes only when the user changes sort or reloads.

## Decisions

What was decided and why, in the order it was settled. Open items are in the [roadmap](./roadmap.md).

### Stack

- **React + Vite + TypeScript in `web/`**
  - Why: Fast dev server, standard setup, types catch API contract mistakes
  - Rejected: Next.js: SSR and routing aren't needed for one page
- **Chakra UI v3**
  - Why: Themeable, accessible by default, ships Combobox, Pagination, Skeleton and Checkbox, which cover most criteria
  - Rejected: Mantine (equally capable, less themeable), Tailwind/shadcn (more assembly for the same result)
- **TanStack Query over `fetch`**
  - Told in full in section 5 (Why this way).
- **Search state in React state, not the URL**
  - Told in full in section 4 (A challenge I kept).
- **Extend the mock API with additive endpoints**
  - Told in full in the Opening (A choice you may ask about: why extend the API).
- **ID-first search with hydration ([ADR 0001](./adr/0001-id-first-search-with-hydration.md))**
  - Told in full in section 3 (How it works, and Why this way).
- **Up to 500 IDs per search (the API's limit is 1,000), the next set on demand**
  - Told in full in section 3 (How it works, step 4).
  - Rejected: A hard cap, which misrepresents results
- **`indexed_at` snapshot token on every window request; mismatch → `409`, the page reloads the first batch; `GET /version` to spot a restart early**
  - Told in full in section 3 (How it works, and What changed along the way).
- **Facet counts for all 7 filters returned by `POST /search/index`, options with no matches listed with `count: 0`**
  - Told in full in section 4 (How it works: counts that stay right).
- **New endpoints strict (unknown fields → `400`), original endpoints left lenient and pinned by baseline tests**
  - Why: A mistyped field fails loudly on the new contract, and nothing existing changes behaviour
  - Rejected: Tightening the original endpoints; leaving the new ones lenient
- **`symbol_openfigi` tie-break on the new search path only**
  - Told in full in section 4 (How it works, step 6) and section 3 (What changed along the way).

### Suggestions and popular searches

- **Popular search** = most searched across all users; **Recent search** = this user's own history
  - Told in full in section 1 (UI choices and why).
- **Popular shown as pills under the input before the first search (6, 8 or 13 by screen size, from one request for 13; with `popularSearchOneLine` on, only the pills that fit on one line show), and as the top five in the popup of the empty input, below Recent searches; suggestions in the popup once the user types**
  - Told in full in section 1 (UI choices and why).
- **The popup never mixes recent searches and suggestions: empty box shows recent then popular, 1 to 2 characters shows only matching recents, 3 or more shows suggestions**
  - Told in full in section 1 (UI choices and why).
- **Search box is a combobox with a full keyboard contract (arrows across both groups, Home/End, Enter, Escape then clear, Tab), live-region announcements and 16px text**
  - Told in full in section 2 (How it works: an accessible search box, and UI choices and why).
- **A new search clears applied filters and keeps the sort**
  - Told in full in section 1 (UI choices and why), and section 4 (Bad flow: filters and a new term). I changed this in #20.
- **Suggestions fire after 200ms pause and from 3 characters**
  - Told in full in section 1 (How it works: suggestions as you type, and the too-short flow).
- **Popup has two groups: search terms and instruments**
  - Told in full in section 1 (UI choices and why).
- **Data reached through seams (`SearchSource`, `SuggestionSource`, `PopularSource`, `RecentSearchStore`)**
  - Why: Real life has thousands of suggested terms and needs a server; swapping an adapter for a real endpoint changes no UI
  - Rejected: UI calling the API directly
- **Search** (a submitted term) vs **Refinement** (filter or sort change)
  - Told in full in section 1 (UI choices and why) and section 2 (UI choices and why).
- **Popular and zero-result insights from a server-side search log ([ADR 0002](./adr/0002-server-side-search-log.md))**
  - Told in full in section 1 (How it works: popular searches and the search log, and Why this way).
- **Popular terms deduped on an order-insensitive word set, ignoring `and`, `the`, `of`, `for`, `asx`; `OR` and `etf` kept**
  - Told in full in section 1 (How it works: popular searches and the search log, step 2).
- **Zero-result terms kept in the log, excluded from pills**
  - Told in full in section 1 (search log, step 5) and section 2 (The problem to solve).
- **Popular fetched once on page load**
  - Told in section 1 (search log, step 5).
  - Rejected: Live refresh
- **Search log saved to a JSON file and seeded once from `popular-seed.json` on the first start (I corrected an earlier note that said "in memory")**
  - Told in full in section 1 (search log, step 6, and What changed along the way).
  - Rejected: Seeding on every start, which would overwrite real use
- **No backup list when popular searches fail to load: the skeleton pills stay**
  - Told in section 1 (search log, step 5).
  - Rejected: Hiding the row
- **Restore for the search log in the Settings tab (`POST /search-log/restore-seed`); `DELETE /search-log` kept but not called by the app; both behind `ENABLE_INSIGHTS`**
  - Told in full in section 6 (Settings tab and Show raw data).
- **Recent searches: saved once the search returns results, last 4, case-insensitive dedupe, not removable, localStorage, updated in memory**
  - Told in full in section 1 (Demo flows, recent searches flow, and search log, step 7).

### Analytics and insights

- **`analytics.track()` with a console adapter, 3 events, display only**
  - Told in full in section 2 (UI choices and why).
- **Search insights panel behind a header gear (demo only, shown only in a development build), from `GET /insights/zero-results`, which only exists when `ENABLE_INSIGHTS=true`**
  - Told in full in section 6 (Insights panel, and Header and gear).
- **"Show raw data" setting: raw API values beside formatted ones (issuer, type, units, range buckets, instrument ID), off by default**
  - Told in full in section 6 (Settings tab and Show raw data).
- **Tunables in one `config.ts`, editable from a "Settings" tab in the gear panel (Save and reload)**
  - Told in full in the Opening (One config file), and section 6 (Settings tab and Show raw data).

### Results, filters, ordering

- **Result rows show logo, ticker, name, type, issuer, flags, units on issue**
  - Why: That's all the data has; no prices or descriptions exist
  - Rejected: Inventing fields
- **"Load more" button that appends the next batch, 15 by default**
  - Told in full in section 3 (UI choices and why).
- **One label per instrument type from one source: "Shares (equities)" / "ETFs" in the filter and chips, "Share (equity)" / "ETF" on a row (#41)**
  - Told in full in section 3 (UI choices and why).
- **Logo falls back to a default image (`onError`), loaded with `no-referrer`**
  - Told in full in section 3 (UI choices and why).
- **A tail of 3 or fewer results merges into the previous batch**
  - Told in full in section 3 (UI choices and why).
- **Missing IDs from the batch are skipped and logged; a failed batch keeps the rows and shows Retry**
  - Told in full in section 3 (UI choices and why) and section 5 (How it works, step 5).
- **One message for major API failures, shown in place of the results only when there is nothing to keep**
  - Told in full in section 5 (How it works, step 5, and Why this way) and [ADR 0007](./adr/0007-one-message-for-major-api-failures.md).
  - Rejected: A full page for every failure; a limit on manual retries; a backup list of popular searches (section 1)
- **A selected filter option is never disabled**
  - Told in full in section 4 (Why this way: Benefits, and What changed along the way).
- **Filter sections ordered Betashares first (Betashares funds only, Flagship funds, Available for Auto Invest, Type, Issuer, Portfolio eligible only, Shares issued (equities only)); issuer shows 8 before "Show all" (#39)**
  - Told in full in section 4 (UI choices and why).
- **Result rows not clickable**
  - Told in full in section 3 (UI choices and why).
- **All 7 filters, with live counts; zero-count options disabled, not hidden**
  - Told in full in section 4 (Why this way, and A challenge I kept).
- **The frontend displays data as given and never interprets it; data quality is the backend's job**
  - Told in full in the Opening (Problems in the data).
- **Issuer label = display only, from `issuerLabel(slug)` (casing override map, else title-case); the slug stays the value; colliding labels show the slug as a hint**
  - Told in full in section 4 (UI choices and why), and section 6 (Settings tab and Show raw data) for the raw-value hint.
- **"Portfolio eligible only" and "Shares issued (equities only)" framing**
  - Told in full in section 4 (UI choices and why).
- **Drill-down: AND across sections, OR within one**
  - Told in full in section 4 (How it works: counts that stay right, step 2).
  - Rejected: Appending relaxed "OR" results below
- **Sort by: Best match (default), ASX code (ticker) A – Z / Z – A, Investment name A – Z / Z – A, Shares issued high – low / low – high**
  - Told in full in section 4 (UI choices and why, and the Shares issued sort flow).
- **Sort in the results header, separate from filters, applied immediately, computed server-side**
  - Told in full in section 4 (UI choices and why, and How it works, step 6).
- **Filters apply as you tick on tablet and desktop, and on a button in the mobile drawer. Counts update live through counts-only requests ([ADR 0003](./adr/0003-refinements-apply-on-button.md), [ADR 0004](./adr/0004-live-filters-on-tablet-and-desktop.md))**
  - Told in full in section 4 (What changed along the way: Button, then live).
- **Applied-filter chips with ×, plus "Clear filters" (filters only), both applied immediately**
  - Told in full in section 4 (Demo flows: chips, and UI choices and why).
- **Button wording: "Show 1 result" / "Show 31 results" / disabled "No matching results"**
  - Told in section 4 (UI choices and why).
  - Rejected: "Apply filters"

### Layout

- **Mobile-first; mobile 0–759px, tablet 760–1029px, desktop 1030px+**
  - Why: Most retail investors browse on phones; breakpoints match the site's own content width
  - Rejected: Desktop-first
- **Mobile: single column, filters in a drawer, sort beside the Filters button**
  - Told in full in section 4 (Demo flows: responsive flow).
  - Rejected: Filters stacked above results
- **Tablet/desktop: search across the top, 260px filter rail, results on the right; desktop capped at 1030px**
  - Told in full in section 4 (Demo flows: responsive flow).
  - Rejected: Filters in a top bar
- **Nothing is sticky; the header scrolls with the page, and the filter button sits in the flow (#17, [ADR 0004](./adr/0004-live-filters-on-tablet-and-desktop.md))**
  - Told in full in section 6 (Header and gear) and section 4 (What changed along the way: Button, then live).
- **Breakpoint scale: base, mobileLarge 560, tablet 760, tabletLarge 895, desktop 1030, desktopLarge 1200, desktopXLarge 1400, with a 360px minimum width**
  - Told in section 4 (UI choices and why).
  - Rejected: Chakra's default breakpoints
- **Full-width result rows, not a card grid**
  - Told in full in section 3 (UI choices and why).

### Security

- **Popular ranked by distinct clients, minimum threshold of 3, rate limit on logging per IP (60 a minute, burst 20) and per client (20 a minute, burst 10)**
  - Told in full in section 1 (Why this way: Benefits, and Protection and its limits).
- **Only terms with results qualify for popular; terms with `OR` excluded**
  - Told in full in section 1 (Why this way: Protection and its limits).
- **Validation on new endpoints (enums, ID format, max 100 IDs, body size, term length), capped log with eviction**
  - Told in full in section 6 (Security) and section 1 (Protection and its limits).
- **CORS stays the existing global development policy; rate limits are the abuse control**
  - Told in full in section 6 (Security).
- **User text always rendered as text, no `dangerouslySetInnerHTML`; `npm audit` clean**
  - Told in full in section 6 (Security).

### Design

- **Theming as a separate phase: build and test on Chakra's default theme first**
  - Told in full in section 6 (Theme and accessibility audit).
- **Own `DESIGN.md`, correcting the automated extraction**
  - Told in full in section 6 (Theme and accessibility audit: Corrections to the automated extraction).
- **Brand orange `#fc4d16` everywhere, WCAG failures listed and fixed next ([ADR 0005](./adr/0005-match-brand-then-fix-wcag.md))**
  - Told in full in the Opening (Accessibility issues in the reference page and style guide).
- **Rund Text and Rund Display hotlinked from betashares.com.au, Inter until they load, never committed**
  - Told in full in section 6 (Theme and accessibility audit: Fonts).
- **Inputs 5px radius, buttons pill, cards 15px (30px from desktop)**
  - Told in section 6 (Theme and accessibility audit: Corrections to the automated extraction).

### Testing and code structure

- **Baseline API tests for existing behaviour before any change**
  - Told in full in section 6 (Tests).
- **Minimal backend footprint: new files, reuse existing services, touch existing files only for wiring**
  - Why: The brief is mainly frontend; less change to `api/` means less risk
  - Rejected: Refactoring the mock
- **Contract tests start the real API as a child process on a spare port and run the real client and `SearchSource` against it**
  - Told in full in section 6 (Tests).
- **Component tests (jsdom) cover the combobox keyboard and ARIA contract with jest-axe, the filter apply flow with stale counts ignored, load-more focus and live-region text, failures and the 409 restart**
  - Told in full in section 6 (Tests).
- **Pure logic in plain TypeScript modules, thin components; DRY**
  - Why: Logic is unit-testable without rendering, and each concept lives in one place
  - Rejected: Logic inside components
- **Conventional Commits, atomic, a branch and PR per workstream, no squash**
  - Why: Reviewers can read the history by body of work; each commit is one logical change
  - Rejected: One large commit; squash merges
- **Transparent AI use: AI credited in commits, a "How I used AI" section**
  - Why: The brief allows AI "with caution"; showing how it was directed and reviewed is the caution
  - Rejected: Hiding or overstating AI use
- **Every test runs with one `npm test`, assuming reviewers have no AI tooling and no browser test tooling**
  - Told in full in section 6 (Tests).
- **No browser E2E suite: Playwright explored and rejected; cross-boundary risks tested inside `npm test` instead (in-process contract tests, supertest CORS preflight, jsdom focus and live-region checks)**
  - Told in full in section 6 (Tests: Why no browser end-to-end suite).

## Architecture talking points

Each point is told in full in the section named. The takeaway is one sentence.

- **ID-first search with hydration** (section 3): search returns ordered IDs, a store holds documents, and only missing IDs are fetched.
- **Backend contract shaped by the frontend** (the Opening, and sections 1 and 3): each new endpoint exists because the original API couldn't do something the page needed.
- **Seams** (section 1, and the Decisions list): the UI never knows how data is fetched.
- **Data layer** (section 5): TanStack Query handles caching, cancellation and loading states.
- **Security** (sections 1 and 6): popular pills can't be gamed by one script, new endpoints validate input, and user text is never rendered as markup.
- **Design** (section 6): Chakra UI v3 themed from `DESIGN.md`, which corrects the automated brand extraction.
- **Not built, on purpose** (the Close): see the [roadmap](./roadmap.md)'s out-of-scope list.
