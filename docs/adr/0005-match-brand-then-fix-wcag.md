# Match the Betashares brand exactly first, then fix its WCAG failures

The look follows the current Betashares branding and style guide exactly, including the colours and fonts it uses today. Matching it is an important requirement for this project, so I decided to do that first. Some of those choices fail WCAG 2.2 AA. I know about them, they are listed in [`DESIGN.md`](../../DESIGN.md), and fixing them is the next piece of work. This reverses the line in #21's acceptance criteria that said accessibility comes before brand-exact colour.

## Why

The brand is a requirement, not a preference. The reference is the live Betashares fund page, so the theme takes its computed styles (colours, sizes, radii, fonts) read from that page with a script, rather than estimates from screenshots.

Matching first and fixing second leaves a clean before and after. The exact brand is on record, and the accessibility work becomes a bounded list with a measured ratio for each item. The alternative was to soften the brand as I went, and then there would be no record of what the brand actually asks for.

I tried two fixes along the way and measured both:

- White text on a darker orange (`#dc3703`) is 4.57:1 and passes, but the orange is visibly different from the brand.
- Dark text (`#09090a`) on the brand orange (`#fc4d16`) is 5.89:1 and passes, but the text is no longer white.

I rejected both for now because each one moves away from the brand. They are the first two options for the fix pass.

## Consequences

These pairs fail today. Each one is in the named allow-list in `web/src/theme.test.ts`, and the test asserts that it still fails by about the ratio shown, so the list can't go stale.

| Issue | Worst ratio | Where it shows | Needs |
| --- | --- | --- | --- |
| White text on `#fc4d16` | 3.38:1 | Top strip, Search button, ticker pills, "Demo data" badge, checked controls | 4.5:1 |
| Orange text and icons on the grey page, and orange links on white | 2.90:1 | Page title, links, orange labels | 3:1 large text, 4.5:1 normal |
| Light grey text on light backgrounds | 2.24:1 to 4.19:1 | Placeholders, disabled and zero-count filter options | 4.5:1 |
| Light outlines on form controls | 1.17:1 to 1.36:1 | Checkbox, radio and select borders (WCAG 1.4.11) | 3:1 |
| White inputs with no border on the grey page | 1.17:1 | The search field (WCAG 1.4.11) | 3:1 |
| Text under 16px | n/a | Pills, badges, tags, helper text, labels, counts, button labels | 16px |
| Hover orange with white text | 4.03:1 | Search button and links on hover | 4.5:1 |

Everything else passes. Ink, muted text, and the success, warning and error colours are at least 4.5:1 on both the grey page and white cards.

- The page is only as accessible as its worst pair until the fix pass lands. Anyone reviewing it should read the README section and `DESIGN.md` first.
- The fonts (Rund Text and Rund Display) are loaded from the Betashares site and never committed. If that host is unreachable, Inter shows instead.
- The fix pass changes values in `web/src/theme.ts` and the allow-list tests, and should not need component changes.
