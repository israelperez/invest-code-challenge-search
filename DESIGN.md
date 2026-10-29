# Design System

Source of truth for the search app's look. Derived from [`docs/design/betashares-extraction.md`](./docs/design/betashares-extraction.md) (an automated extraction of betashares.com.au, kept untouched as reference), with its errors corrected. The Chakra UI theme is built from this file; when the two disagree, this file wins.

## Corrections to the extraction

| Extraction said | Problem | Here |
| --- | --- | --- |
| Body font "Apple Color Emoji" | Emoji fallback font, picked up by mistake | Rund Text everywhere, Rund Display for headings |
| `hairline: #ffffff` | Invisible on a white canvas | `#e7e7e7` |
| `#fc4d16` for links and button fills | 3.4:1 on white, fails WCAG AA for normal text | Kept on purpose to match the target; listed under "Known WCAG exceptions" below. Fixing it is the next task |
| accent-1/2, success, warning, error | WordPress Gutenberg default palette, not Betashares | Own semantic colours, all AA on both surfaces |
| Radius `md 8px` vs `xl 15px` for inputs | Contradicts itself; live site inputs are 5px | Inputs 5px, buttons pill, cards 15px (30px from desktop) |
| Page canvas white, cards off-white | The target fund page is warm grey with white containers | Canvas inverted: page `#f0edeb`, cards and panels `#ffffff` |

## Colour

Values are the computed styles of the live Betashares fund page. Where that page fails WCAG, this file copies it and lists the failure below, so the fix is a known, bounded task.

| Token | Hex | Use |
| --- | --- | --- |
| `brand.accent` | `#fc4d16` | Focus rings, active indicators, highlight marks, icons |
| `brand.solid` | `#fc4d16` | The brand orange: fills (primary button, pills, top strip, checked controls), links, the page title, selected labels. White text on it |
| `brand.solid-hover` | `#e8420f` | Hover on `brand.solid` fills and links |
| `brand.subtle` | `#fff1ec` | Highlighted suggestion background |
| `ink` | `#09090a` | Headings and running text |
| `muted` | `#5f5964` | Secondary labels, filter labels, counts, helper text |
| `canvas` | `#f0edeb` | Page background (warm grey) |
| `surface-card` | `#ffffff` | Cards, filter panel, results container, inputs. Skeleton base is `canvas`, so it shows on white |
| `hairline` | `#e7e7e7` | Hairlines inside white cards where a lighter line is wanted (decorative; not used by the results rows now) |
| `divider.canvas` | `#cccccc` | The header's bottom line and the lines between result rows (decorative) |
| `control-border` | `#dddddd` | Checkbox, select and filter input borders |
| `success` | `#177745` | Positive status |
| `warning` | `#9a5b00` | Caution |
| `error` | `#c62828` | Errors |

Named tokens components use:

| Token | Value | Use |
| --- | --- | --- |
| `pill.bg` / `pill.fg` | `brand.solid` / white | Ticker and badge pills |
| `bar.bg` / `bar.fg` | `brand.solid` / white | Orange top strip |
| `tag.bg` / `tag.fg` / `tag.border` | `canvas` / `ink` / `muted` | Result tags (Betashares, Flagship, Auto Invest): neutral, so they do not clash with the orange ticker pill |
| `link` / `link.hover` | `brand.solid` / `brand.solid-hover` | Text links |
| `icon` | `brand.solid` | Meaningful icons |
| `divider` | `hairline` | Light lines inside white cards |
| `helper` | `muted` | Helper text |
| `results` | `surface-card` | White results container |
| `container` (size) | `1030px` | Desktop max width, centred |
| `field` / `field-large` (size) | `48px` / `62px` | Search field height: phone / desktop |
| `field-inner` / `field-inner-large` (size) | `32px` / `46px` | Search button inside the field: the field height less an 8px inset each side |
| `pill` (size) | `22px` | Ticker pill height |
| `gutter` (spacing) | `16px` | Page side padding |
| `indent` (spacing) | `16px` | Options under a group title in the suggestions popup |

### Known WCAG exceptions copied from the target (fix next)

The theme matches the target for now, including these failures, grouped by issue type. `web/src/theme.test.ts` lists them as a named allow-list and asserts each still fails by about the ratio shown, so the list cannot go stale. The secondary button border is `muted` on white (6.8:1), so secondary buttons and popular-search pills pass. A Playwright audit of the running app (home, results, filter drawer, settings; 1300 and 390 wide) found no other text colour failing.

| # | Issue | Worst ratio | Where it shows | Needed |
| --- | --- | --- | --- | --- |
| 1 | White text on the brand orange `#fc4d16` | 3.38:1 | Top strip label, Search button, ticker pills, "Demo data" badge, checked checkboxes and radios (the badge now shows only in the Insights tab of the gear panel, beside the zero-result terms; the popular searches carry no demo-data label, #13) | 4.5:1 |
| 2 | Orange text and icons on the light grey; orange links on white | 2.90:1 on `canvas`, 3.38:1 on white | Page title (large text, 3:1), any orange label, link or icon | 3:1 large or icon, 4.5:1 text |
| 3 | Light grey text on light backgrounds | 2.24 to 4.19:1 | Zero-count and disabled filter options (`muted` at 50% opacity, `#afacb2`). Placeholder: `muted` at 80% (`#7f7a83`) in the search field | 4.5:1 |
| 4 | Checkbox, radio and select outlines too light | 1.17 to 1.36:1 | Checkbox, radio and select borders (`#dddddd`) | 3:1 (WCAG 1.4.11) |
| 5 | White inputs with no border on the grey canvas | 1.17:1 | The search field (white on `#f0edeb`) | 3:1 (WCAG 1.4.11) |
| 6 | Text below 16px | 14px on about 370 text nodes, 12px on 6 | `body-sm` and `caption` (14px): pills and badges, helper text, field labels, filter option labels and counts, button labels, result detail line, strip label. 12px: raw-value hints | 16px minimum (Israel's rule) |
| 7 | Hover orange with white text | 4.03:1 | Hovered Search button, hovered links (`#e8420f`) | 4.5:1 |

## Typography

Rund Text and Rund Display are hotlinked from the Betashares site (never committed to the repo), `font-display: swap`, with Inter as fallback. The `@font-face` rules live in `web/index.html`: Rund Text 300, 400, 500, 600 and 700, and Rund Display 500, all `.woff2` under `https://www.betashares.com.au/wp-content/themes/betashares/fonts/`.

Body stack: `"Rund Text", Inter, -apple-system, system-ui, sans-serif`. Headings: `"Rund Display", "Rund Text", Inter, -apple-system, system-ui, sans-serif`. Real weights exist (400, 500, 600), so emphasis can use weight as well as size.

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `display-lg` | 68 / 66 desktop, 56 / 54 tablet, 44 / 42 phone, -0.02em | 500 | Page title, centred, `brand.solid` |
| `title-lg` | 22 / 1.3 | 500 | Section heads |
| `title-md` | 18 / 1.4 | 500 | Result name |
| `title-sm` | 16 / 1.4 | 500 | Filter group labels, insight terms |
| `body-md` | 16 / 1.4 | 400 | Default text, inputs |
| `body-sm` | 14 / 20 | 400 | Small text, pills |
| `caption` | 14 / 20 | 500 | Badges, result tags |

## Shape, space, depth

- Radius: inputs `5px`, buttons pill (`9999px`), results card `15px` on phones and `30px` from desktop, badges and pills pill.
- Spacing: 8px grid (4px allowed inside components).
- Shadow: `rgba(9,9,10,.15) 0 5px 15px 0` on floating layers only (suggestion dropdown, mobile filter drawer). Cards use surface contrast (white on the grey canvas), not shadow.
- Focus: 2px `brand.accent` ring with 2px offset, visible on every interactive element.

## Components

- **Top strip**: full width, 44px, `bar.bg` with `bar.fg` text, 14px / 500, carrying the "Israel Perez - Assessment" label on every screen size.
- **Header**: on the page canvas with no fill of its own, logo left, gear right, 1px `divider.canvas` bottom border, no shadow.
- **Gear button**: 40px circle like the target's round icon button: white fill, `ink` icon that follows `currentColor`, 1px `muted` border so it shows on the grey canvas, hover `brand.subtle`. No size change between states. The gear and its Insights and Settings tabs exist for this demo only; a production version of the page would not have them.
- **Page title**: centred `display-lg` in `brand.solid` (Rund Display 500); other headings stay `ink`.
- **Search field**: one full-width white field, no visible border, 5px radius, 16px text, search icon left. The Search button sits inside it at the right end (pill, inset 8px, `field-inner` tall) with the clear button to its left; the input's end padding keeps text from running under either. 48px tall on phones, 62px from desktop; the border turns `brand.accent` on focus. The label is 16px / 500. The suggestions list matches the field's full width. Focus order: input, clear, search.
- **Search suggestions** (the popup under the field, shared by Suggested searches, Matching shares and ETFs, Recent searches and any later group): white floating layer with the floating shadow, as wide as the field. Group titles keep the plain item padding; options are indented one `indent` (16px) from their title so a heading reads apart from an item. The highlighted row (`brand.subtle`) spans the full row width. Set once in the combobox recipe.
- **Primary button** (Button variant `solid`, the default): `brand.solid` fill and border, white text, pill, 14px / 500; hover `brand.solid-hover`, same size and weight. Heights follow the size: 42px at `md`, and the in-field Search button is `field-inner` tall. Used for: Search (inside the field), Load more, the Retry buttons in error alerts, and Save and reload in Settings.
- **Secondary button** (Button variant `outline`): white fill, `ink` text, 1px `muted` border (the gear button's border colour), pill, 14px / 500, 32px tall at `sm`; hover is the canvas tint. A disabled secondary button keeps full opacity (a faded one looked broken) with the not-allowed cursor. Components set a variant and size only, with no colour or border props, and a fixed width where the label swaps so nothing resizes. Used for: Clear filters (filter rail, filter drawer and the applied-filter chips row), Show all / Show fewer, the counts Retry, Show N results in the drawer, the popular-search pills, the Filters trigger (`md`, 42px) and the Settings panel buttons.
- **Tertiary button** (Button variant `tertiary`): the result-tag scheme (`tag.bg` fill, `tag.fg` ink text, 1px `tag.border`) on the secondary button's geometry: 32px tall at `sm`, 14px / 500, pill. Used for the applied-filter chips: each chip is a button named "Remove <label>" with an X icon inside. Chips wrap onto new lines at every width; a long label is cut with an ellipsis (the aria-label keeps the full name).
- **Ticker pill**: `pill.bg` with `pill.fg`, 22px tall, 14px / 400, pill.
- **Result tag**: `tag.bg` with `tag.fg`, 14px / 500, pill, 1px `tag.border`; neutral, so it reads next to the orange ticker pill.
- **Checkbox**: white fill, 1px `control-border`, 5px radius, `brand.solid` with a white tick when checked. Labels use `muted`.
- **Results card**: white, 15px radius (30px from desktop), 24px top padding, 16px side padding (32px from desktop), a `divider.canvas` (`#cccccc`) divider between rows. No shadow.
- **Skeleton**: `canvas` base, mirrors the real element's dimensions.

Interactive elements never change size or weight between states (no layout shift).

## Layout

Mobile-first: base styles are for phones, and each breakpoint adds to them from its minimum width up. Breakpoints are defined once in the theme:

| Token | Min width |
| --- | --- |
| `base` | 0 |
| `mobileLarge` | 560px |
| `tablet` | 760px |
| `tabletLarge` | 895px |
| `desktop` | 1030px |
| `desktopLarge` | 1200px |
| `desktopXLarge` | 1400px |

The minimum supported screen width is 360px. At that width and above, nothing overflows, clips, overlaps or scrolls sideways.

## Change notes

Changed 2026-10-27 (Israel, #21): retheme to match the target Betashares fund page exactly, copying its WCAG failures until the next task. Values below are the target's computed styles. The page canvas is warm grey `#f0edeb` with white containers (`surface-card` was `#f8f6f4` and `canvas` `#ffffff` in the first version). The brand orange `#fc4d16` is now `brand.solid` and is used for fills, links, the page title and selected labels, with white text on fills; this supersedes the earlier rules "`#fc4d16` is never text or a text-bearing fill" and the interim `brand.fill` (ink text) and `brand.display` tokens, which are removed. `#dc3703` is gone. Other value changes: `muted` `#5f5964`, `control-border` `#dddddd`, `divider.canvas` `#cccccc` (header line), hover `#e8420f`, buttons and pills fully rounded (were 15px), results card 15px / 30px (was 10px), body text 16px (was 14px), page title `display-lg` in Rund Display (was `display-md` in Rund Text), search field white with no visible border at 48px / 62px, and the top strip 44px on all sizes. The fonts now come from the Betashares host with real weights (300 to 700 for Rund Text, 500 for Rund Display); the single-weight note is removed. The exact failures are listed under "Known WCAG exceptions copied from the target (fix next)". The header now carries an orange top strip, a canvas-coloured row with a `divider.canvas` border and a white round gear button (ink icon, `muted` border, `brand.subtle` hover). Follow-up: applied-filter chips are the new tertiary button (tag colours, 32px pill; `chip.*` tokens removed), and result rows are top-aligned with `divider.canvas` lines between them. Not copied from the target: its nav, performance columns, quick view and compare checkboxes. Follow-up (Israel, #21): the Search button moved inside the full-width field (clear button to its left); the filter buttons share one secondary style with `muted` text and border; result tags are neutral (`tag.*` tokens) instead of orange; and the exceptions list is grouped by issue type and now includes disabled and placeholder text, borderless white inputs, light outlines and text below 16px. Earlier versions of this file, kept in git history, hold the original design.
