# Filters apply as you tick on tablet and desktop; the mobile drawer keeps its button

This supersedes [ADR 0003](./0003-refinements-apply-on-button.md) for the filter rail. From the `tablet` breakpoint (760px) up, where the rail sits beside the results, each filter change updates the results after the same debounce the counts use, and the rail has no apply button. Below it, in the mobile filter drawer, nothing changes: ticks edit pending filters, and "Show N results" applies them.

## Why

In review, the rail's apply button sat at the bottom of a tall column and got missed, especially when it was below the fold. Being sticky, it covered rows and hid that the list carried on. Moving it to the top would only move the problem, since ticking an option further down puts it out of view.

Current research splits by device. Baymard (2026) treats live updates as the expected pattern on desktop, and an apply button showing the live count as the right one on mobile. Maersk's design system uses live updates when results come back in under a second, which ours do. DWP's design system prefers a button everywhere, but calls that a theory it still needs to test.

The churn ADR 0003 was worried about matters less on desktop, because the results sit beside the rail and you see each change land. Quick ticks still collapse into one request.

## Consequences

- Each change on desktop sends a counts request and a results request for the same state. Including facets in the results request would remove the extra one.
- Tablet/desktop and mobile now behave differently, so the component tests cover both modes.
