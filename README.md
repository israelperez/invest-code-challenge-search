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
- **Popular and recent searches.** The API logs every submitted search. Popular searches are the most searched terms across all users that return results, deduped and protected against manipulation. They are demo data: the API seeds a fake history on its first start and then keeps the log in a file; the UI doesn't label it. When there is no popular data, or the fetch fails, the pills fall back to featured Betashares ETFs. Recent searches are the user's own last five, kept in the browser. See [ADR 0002](./docs/adr/0002-server-side-search-log.md).
- **Analytics.** Searches are shown in the browser console with an `[analytics]` prefix. The gear in the header opens zero-result search terms from the API's log, and demo settings for page size, suggestion timing and similar values.
- **API changes.** Two search endpoints and the search log are added to the mock in `api/`. Existing endpoints are unchanged. See [`api/README.md`](./api/README.md).
- **Styling.** Chakra UI v3, themed from [`DESIGN.md`](./DESIGN.md).

The gear icon in the header is for development only. It shows the searches that found nothing and a few demo settings. It appears when you run `npm run dev` and is switched off in a production build, so a real visitor wouldn't see it.

## Project layout

- [`api/`](./api/): the mock Search API that came with the challenge. The original endpoints are unchanged. I added new ones for searching, fetching instruments in bulk and recording searches.
- [`web/`](./web/): the search page, built with React. The search logic sits in plain TypeScript files that can be tested on their own, and the screen components stay small.
- [`docs/`](./docs/): the walkthrough, the decision records, the roadmap and the planning notes.

## Security notes

This is a demo, and the API is a local mock, so security is a lot lighter than a real product would need. Here is what is and isn't protected.

- The app shows "popular searches" built from what people have searched. Anyone can see them, so someone could try to game the list. To make that harder, a term only counts once several different users have searched it, and it only appears if it actually returns results. Each user is also limited in how fast they can log searches.
- "Different users" is a guess. The browser makes up a random ID for itself and sends it with each search, and nothing proves it belongs to a real person. Someone who sends lots of made-up IDs could still push a term up. The speed limits slow that down but don't stop it, and they reset whenever the API restarts.
- The new endpoints check what they are sent. Unknown fields, bad values, badly formed IDs, requests over 32KB and very long search terms are rejected with a 400 error. The search log has a size cap and drops old entries, so a flood of unique terms can't fill up memory. The original endpoints behave exactly as they did before.
- There is no login. Anyone who can reach the API can read the zero-result terms and reset the popular searches. That is why the screen that uses them is development-only. The API also allows requests from any website, which is how the mock was set up. That is convenient for development but isn't a security measure.
- Text a user types is only ever shown as plain text, never run as HTML. This matters because logged search terms are displayed back in the insights view.
- `npm audit` reports no known vulnerabilities in `api/` or `web/`.

The reasoning for each choice is in the [walkthrough](./docs/walkthrough.md) and [ADR 0002](./docs/adr/0002-server-side-search-log.md).

## What a real build would add

The challenge is a demo, so these were left out on purpose. A real product would need them.

- A login for staff, so only they can see which searches found nothing and reset the popular searches.
- A proper way to know who a visitor is, and protection against bots and floods of requests at the front door of the system rather than inside the API.
- A database for the search log. Today it lives in a file next to the API, and it is lost if that file is deleted.
- A proper analytics system. At the moment searches are only printed in the browser console, with the same data kept in the API's log file. A real one would send them to a data warehouse and produce a regular report of what people searched for and didn't find.
- A dedicated endpoint for the suggestions as you type. The app currently builds them from two existing calls. The code is already set up so the endpoint can be swapped in.
- "Did you mean" for typos, for example someone typing `VSG` when they mean `VGS`.
- An error reporting service in place of the browser console, and a font file the project owns. The Betashares font (Rund Text) is loaded from another website here, with Inter as the backup, because I haven't confirmed I'm allowed to include the font files.
- Prices and performance, if the data included them. The mock doesn't have any.

The full list is in the [roadmap](./docs/roadmap.md).

## What isn't automated

`npm test` runs the whole automated suite. It checks the API, the search logic, the page talking to a real running API, and the on-screen components, including keyboard use and screen reader labels. It can't check how the page looks.

I didn't add a browser-based test, because the tool for it needs hundreds of megabytes of extra downloads for a single check. So these are checked by hand using the demo flows in the [walkthrough](./docs/walkthrough.md):

- the layout on a phone, a tablet and a desktop
- using the page with a real screen reader

## How AI was used

Claude Code (Anthropic) wrote most of the code, tests and documentation. A second model, OpenAI Codex, reviewed the changes before each pull request.

My part was strategy, architecture and quality control. Before any building started, I worked out the plan with Claude and settled the decisions that shape the app. Those are recorded in [`docs/adr/`](./docs/adr/) and the [walkthrough](./docs/walkthrough.md), with the options I rejected and why.

- Architecture: I chose the ID-first search design (the server returns ordered IDs and the browser fetches only the instruments it is missing), and the seams the UI depends on, so data sources can be swapped without touching components.
- API contract: I shaped the new endpoints around what the frontend needs, and kept the original endpoints unchanged so nothing already built could break.
- Risk and security: I decided how the popular searches are protected from gaming, and what the demo would and wouldn't claim to secure.
- Scope: I decided what to build, what to cut and what to leave documented as a next step.
- Frontend structure: I kept the search logic in plain TypeScript modules with no React, and the components thin, so the logic can be tested without rendering. I also set how server data is cached and kept fresh, so a changed search snapshot resets the app cleanly instead of showing stale results.
- Accessibility: I required a proper combobox pattern for the search input (labels, ARIA, keyboard use, focus handling and screen reader announcements), and automated checks for it with jest-axe.
- Responsive design: I built mobile first, with a filter drawer on phones and a filter rail on wider screens, and ruled out layout shifts and sticky bars that hide content.
- Design system: I kept components on Chakra's semantic tokens with no hard-coded colours, so the Betashares theme is configuration only. I corrected the automated brand extraction in `DESIGN.md` where it failed contrast (WCAG AA) or used the wrong body font.
- Testing strategy: I set the rule that everything runs from one `npm test` with no extra tooling, and decided which risks are covered by automated tests and which are checked by hand.

Then, for each piece of work, I:

- made the product and design calls, and changed the brief when I saw the result
- tried every change in the browser
- read and reviewed the code and the pull requests
- debugged problems as they came up, including bugs in earlier work
- merged every pull request myself

Each commit is under my name and ends with a `Co-Authored-By` line naming the model that wrote it.

## Branding and accessibility

The look follows the current Betashares branding and style guide, and matching it was an important requirement. I decided to match it exactly first and fix what falls short of WCAG 2.2 AA afterwards, so the gaps are known and listed here instead of missed.

What fails today, with the worst ratio for each (text needs 4.5:1, large text and outlines need 3:1):

- White text on the brand orange (`#fc4d16`), 3.38:1: the top strip, Search button, ticker pills, "Demo data" badge and checked controls.
- Orange text and icons on the grey page, 2.90:1: the page title, links and orange labels.
- Light grey text on light backgrounds, 2.24:1 to 4.19:1: placeholders, and disabled and zero-count filter options.
- Light outlines on form controls, 1.17:1 to 1.36:1: checkbox, radio and select borders.
- White inputs with no border on the grey page, 1.17:1: the search field.
- Text under 16px: pills, badges, tags, helper text, labels, counts and button labels.
- Hover orange with white text, 4.03:1: the Search button and links.

Everything else passes AA. Body text, muted text and the success, warning and error colours are at least 4.5:1 on both the grey page and the white cards. The search box is built as an accessible combobox (labels, ARIA and keyboard use), with jest-axe checks.

[`DESIGN.md`](./DESIGN.md) has the full list and where each item shows up. Each pair has a test that asserts it still fails by that amount, so the list can't go out of date. The decision is recorded in [ADR 0005](./docs/adr/0005-match-brand-then-fix-wcag.md). The fonts are loaded from the Betashares site and aren't in the repo.

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
