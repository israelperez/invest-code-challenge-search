# Major API failures show one message and one report

The API gateway ([ADR 0006](./0006-one-api-gateway-for-retries-and-errors.md)) marks each caller as major or minor. The major callers are `search-index` (the first batch, ID windows, the restart after a 409 and the filter counts) and `instruments-batch` (Load more documents): without them the page cannot show results. When a major call fails after the gateway's retries, the gateway reports it as `major_failure`, to the console (`Major failure: …`) and to a "Major failures (issues message shown)" row at the top of the Data problems panel, and the page shows one message: "The app seems to be experiencing issues", "Try again in a moment.", with a Retry button. Every other caller (`popular`, `suggest-instruments`, `facet-issuer`, `version`, `log-search`, the Insights and Settings calls) is minor: it keeps `api_call_failed` and shows nothing new.

Where the message shows depends on what is already on screen:

- **Nothing to keep** (the first batch or a refinement fails): it replaces the results area.
- **Rows showing** (Load more or the restart after a 409 fails): the rows stay, and the message sits under them in place of the Load more button.
- **Only the filter counts fail**: the rail or the drawer shows only the message. The options, Clear filters and, on phones, the drawer's apply button are hidden until a Retry works, since without counts they promise data that isn't coming and any tick fails again. The drawer's close button stays, and the results are untouched.

The header, search box and sort always stay, so the term, filters and sort survive and Retry reruns the same request. While Retry runs, the button keeps its size, shows a spinner and is disabled.

## Why

Before this, each failure had its own wording ("Something went wrong … Check your connection and try again" for results and Load more, "Couldn't update the counts." in the rail), and one outage on a tablet showed in two Data problems rows with three counts: two `api_call_failed` (results and counts) and one `first_batch_failed`. Once the gateway has given up on a major call, its retries have already covered any blip of a few seconds, so something major has happened, and users get the same message wherever it shows.

Retry stays because the gateway covers seconds (about 21 seconds at most) and an outage can last minutes. Without it the only way back is a reload, which loses the term and filters. "Check your connection" was dropped: in production most outages are on the server side, so it would blame users for a fault that isn't theirs.

The filter counts are major because they come from the same `POST /search/index` as the results: if the counts fail, the results almost certainly fail too. `facet-issuer` is minor despite its name, because it only feeds the issuer suggestions while typing.

The three caller reports (`first_batch_failed`, `load_more_failed`, `restart_failed`) are removed, since they reported the same failure as the gateway. Their entries named the search term; the gateway's entry names the caller. The term is on screen anyway.

## Considered options

- **A full-page message for every failure.** Rejected: it loses the typed term, filters and sort, stops users trying another search, and says the whole app is down while the header and search still work.
- **Replace the results even when rows are showing.** Rejected: blanking loaded rows because the next batch failed destroys content that works.
- **Limit manual retries** (stop after 3 with "reload the page", a cooldown, or a `maxManualRetries` config value). Rejected: a courtesy, not protection. Each Retry already runs the gateway's 4 attempts with the button disabled, a reload resets any count kept in the browser, and real protection is server rate limiting.
- **A backup list of popular searches when the API fails.** Rejected: false confidence while the backend has a problem.
- **An inline "Couldn't load popular searches" line.** Rejected: popular searches are minor; the skeleton pills stay and the gateway reports the failure.
- **Keep the caller reports beside the gateway's, as "what users saw" rows.** Rejected: one outage would still show in two rows.
- **Collapse reports within a time window so one outage counts once.** Rejected: timer logic for a cosmetic gain. The count is failed calls, so a tablet outage counting 2 (results and counts) is accurate.

## Consequences

- Severity belongs to the caller: a new endpoint call is marked major or minor when it is added to the client.
- The Data problems panel has one "Major failures" row in place of three, and "API calls that failed" holds minor callers only.
- The message and its Retry button are one component, used in the results area, under the rows and in the rail and drawer.
