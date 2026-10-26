# Betashares Invest Coding Challenge: Search App

> **Reviewing this solution?** Setup is under [Solution](#solution) below. The design, decisions and demo flows are in **[`docs/walkthrough.md`](./docs/walkthrough.md)**.

This is a coding challenge to test your flair for building a search and filters page using a mock API as the backend.

You can build the app in React, Vue or Angular, and use any third-party libraries you wish.

## Contents

- [ASSIGNMENT.md](./ASSIGNMENT.md): the full assignment brief
- [api/](./api/): a local mock of the backend Search API, serving instrument data

## Candidate Instructions

Start with [ASSIGNMENT.md](./ASSIGNMENT.md).

Run the mock Search API from the repository root:

```bash
npm run api:install
npm run api        # http://localhost:8787
```
> **Note:** this setup is superseded by the solution's [Setup](#setup) below, which installs and runs the API and the web app together.

See [api/README.md](./api/README.md) for its endpoints, request format and examples.

---

# Solution

A search page for ASX-listed instruments, built in React against the mock Search API.

**How it was designed and why:** [`docs/walkthrough.md`](./docs/walkthrough.md) covers the architecture, every key decision with its trade-offs, and step-by-step demo flows.

## Setup

Requires Node 20.19 or later.

```bash
npm run setup   # installs the API and the web app
npm run dev     # runs both: API on http://localhost:8787, app on http://localhost:3000
```

Then open [http://localhost:3000](http://localhost:3000). Ctrl-C stops both servers.

You can also run them in two terminals, which is handy when you want to restart the API on its own:

```bash
npm run api     # terminal 1: mock Search API on http://localhost:8787
npm run web     # terminal 2: app on http://localhost:3000
```

To run the tests, use `npm test`. It runs the API suite and then the web suite, including a contract test that starts the real API on a spare port. You don't need a browser or any extra tooling.

## How it works

The app is a single page in [`web/`](./web/): a search input with a suggestions popup, popular search pills, a filter panel, sortable results and a "Load more" button. It's mobile-first, with a filter drawer on phones and a filter rail from 760px.

- **Searching.** Typing three or more characters fetches suggestions after a short pause: matching search terms and the top five instruments. Submitting a search (Enter, a suggestion, a popular pill or a recent search) runs it immediately.
- **ID-first results.** A search calls `POST /search/index`, which returns the total, all filter counts, the matching instrument IDs in order, and the first batch of instruments. The browser keeps each instrument it has loaded, so "Load more" and later searches fetch only the ones it doesn't have yet, from `POST /instruments/batch`. The server does all filtering, sorting and counting. See [ADR 0001](./docs/adr/0001-id-first-search-with-hydration.md).
- **Filters and sort.** Filter counts update as options are ticked, and the results update when the user presses "Show X results". Sections narrow the results together; options within a section widen them. Sort sits above the results and applies straight away.
- **Popular and recent searches.** The API logs every submitted search. Popular searches are the most searched terms across all users that return results, deduped and protected against manipulation. Recent searches are the user's own last five, kept in the browser. See [ADR 0002](./docs/adr/0002-server-side-search-log.md).
- **Analytics.** Searches are shown in the browser console with an `[analytics]` prefix. The gear in the header opens zero-result search terms from the API's log, and demo settings for page size, suggestion timing and similar values.
- **API changes.** Two search endpoints and the search log are added to the mock in `api/`. Existing endpoints are unchanged. See [`api/README.md`](./api/README.md).
- **Styling.** Chakra UI v3, themed from [`DESIGN.md`](./DESIGN.md).

## Project docs

| File | What's in it |
| --- | --- |
| [`docs/walkthrough.md`](./docs/walkthrough.md) | **Start here:** architecture, decisions, demo flows |
| [`docs/adr/`](./docs/adr/) | Architecture decision records |
| [`docs/roadmap.md`](./docs/roadmap.md) | Features, grouped by body of work, MVP vs extra |
| [`CONTEXT.md`](./CONTEXT.md) | Domain glossary |
| [`DESIGN.md`](./DESIGN.md) | Design system used for the theme |
| [`docs/design/betashares-extraction.md`](./docs/design/betashares-extraction.md) | Raw brand extraction from betashares.com.au, kept for reference |
| [`docs/planning/`](./docs/planning/) | The locked plan and its review log |
