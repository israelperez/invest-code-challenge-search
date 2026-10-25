# Design System

Source of truth for the search app's look. Derived from [`docs/design/betashares-extraction.md`](./docs/design/betashares-extraction.md) (an automated extraction of betashares.com.au, kept untouched as reference), with its errors corrected. The Chakra UI theme is built from this file; when the two disagree, this file wins.

## Corrections to the extraction

| Extraction said | Problem | Here |
| --- | --- | --- |
| Body font "Apple Color Emoji" | Emoji fallback font, picked up by mistake | Rund Text everywhere |
| `hairline: #ffffff` | Invisible on a white canvas | `#e7e3df` |
| `#fc4d16` for links and button fills | 3.4:1 on white, fails WCAG AA for normal text | Text and text-bearing fills use `#dc3703` (4.6:1); `#fc4d16` kept for non-text accents |
| accent-1/2, success, warning, error | WordPress Gutenberg default palette, not Betashares | Own semantic colours, all AA on white |
| Radius `md 8px` vs `xl 15px` for inputs | Contradicts itself; live site inputs are 5px | Inputs 5px, buttons 15px, cards 10px |

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| `brand.accent` | `#fc4d16` | Non-text accents only: focus rings, active indicators, highlight marks, icons (≥3:1) |
| `brand.solid` | `#dc3703` | Primary button fill, text links, selected states with text |
| `brand.solid-hover` | `#b82e02` | Hover / pressed on `brand.solid` |
| `brand.subtle` | `#fff1ec` | Selected chip / highlighted suggestion background |
| `ink` | `#09090a` | Headings, primary text |
| `body` | `#353536` | Running text |
| `muted` | `#757576` | Secondary labels, counts (4.6:1) |
| `canvas` | `#ffffff` | Page background |
| `surface-card` | `#f8f6f4` | Cards, skeleton base, filter panel |
| `hairline` | `#e7e3df` | Input and card borders, dividers |
| `success` | `#1a7f4b` | Positive status |
| `warning` | `#9a5b00` | Caution |
| `error` | `#c62828` | Errors |

Rules: one filled `brand.solid` element per view where possible; never `#fc4d16` behind or as text.

## Typography

Rund Text, hotlinked (never committed to the repo), with Inter as fallback:

```css
@font-face {
  font-family: "Rund Text";
  src: url("https://db.onlinewebfonts.com/t/f8f02ccd4a027f7cccb4e9ac22f959c2.woff2") format("woff2"),
       url("https://db.onlinewebfonts.com/t/f8f02ccd4a027f7cccb4e9ac22f959c2.woff") format("woff");
  font-display: swap;
}
```

Stack: `"Rund Text", Inter, -apple-system, system-ui, sans-serif`. The host serves a single weight, so emphasis comes from size before weight.

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `display-md` | 38 / 1.15, -0.5px | 500 | Page title |
| `title-lg` | 22 / 1.3 | 500 | Section heads |
| `title-md` | 18 / 1.4 | 500 | Result name |
| `title-sm` | 16 / 1.4 | 500 | Ticker, filter group labels |
| `body-md` | 14 / 1.55 | 400 | Default text, inputs (search input 16px to stop iOS zoom) |
| `body-sm` | 12 / 1.55 | 400 | Fine print |
| `caption` | 13 / 1.4 | 500 | Badges, counts |

## Shape, space, depth

- Radius: inputs `5px`, buttons `15px`, cards `10px`, badges pill.
- Spacing: 8px grid (4px allowed inside components).
- Shadow: `rgba(9,9,10,.15) 0 5px 15px 0` on floating layers only (suggestion dropdown, mobile filter drawer). Cards use surface contrast, not shadow.
- Focus: 2px `brand.accent` ring with 2px offset, visible on every interactive element.

## Components

- **Search input**: 48px tall, canvas fill, 1px `hairline` border, 5px radius, border turns `brand.accent` on focus. Search icon left, clear button right.
- **Primary button**: `brand.solid` fill, white text, 15px radius, 40px tall, 14px / 500.
- **Secondary button**: canvas fill, `ink` text, 1px `hairline` border, same geometry.
- **Badge**: `surface-card` fill, `ink` text, pill, `caption`.
- **Result card**: canvas fill, 1px `hairline` border, 10px radius. Hover darkens the border to `muted`, no size change.
- **Skeleton**: `surface-card` base, mirrors the result card's dimensions exactly.

Interactive elements never change size or weight between states (no layout shift).
