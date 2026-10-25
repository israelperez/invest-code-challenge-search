# Filter changes apply on a button; searches and sort apply immediately

Ticking filters doesn't update the results. A debounced counts-only request keeps facet counts and the button total ("Show 31 results") live, and results are fetched only when the user presses the button. This applies on every breakpoint: in the mobile drawer and in the tablet/desktop filter rail. Searches (typed, suggestion, popular, recent) and sort changes apply immediately, because each is already a complete decision.

## Why

Live-applying every tick fetches results the user never looks at and makes the list churn while they're still deciding. Counts still need the server (AND combinations across facets can't be computed in the browser), so we request only counts while ticking: a small response, debounced so quick ticks collapse into one request. The live total on the button tells users what they'll get before committing and stops them applying into zero results.

## Consequences

- One extra click on desktop compared with the common live-apply pattern.
- Closing the mobile drawer without pressing the button discards pending changes; a new search keeps applied filters but discards pending ones.
