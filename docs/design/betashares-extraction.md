---
version: alpha
name: betashares-com-au-design-analysis
source: https://www.betashares.com.au/
extracted: 2026-10-25
description: A clean light-canvas interface extracted from betashares.com.au. The system anchors on a pure white canvas (#ffffff) with "Rund Text" display over "Apple Color Emoji" body, a coral primary accent (#fc4d16) on CTAs and links, and dark contrast surfaces (#09090a) for emphasis moments and the footer.

colors:
  primary: "#fc4d16"
  primary-active: "#dc3703"
  primary-disabled: "#fed3c5"
  ink: "#09090a"
  body: "#353536"
  body-strong: "#1d1d1e"
  muted: "#757576"
  muted-soft: "#989898"
  hairline: "#ffffff"
  canvas: "#ffffff"
  surface-soft: "#f9f6f4"
  surface-card: "#f8f6f4"
  surface-dark: "#09090a"
  surface-dark-elevated: "#17171a"
  on-primary: "#ffffff"
  on-dark: "#f5f5f5"
  on-dark-soft: "#a2a2a3"
  accent-1: "#0693e3"
  accent-2: "#00d084"
  success: "#00d084"
  warning: "#fcb900"
  error: "#cf2e2e"

typography:
  display-xl:
    fontFamily: "Rund Text, Inter, sans-serif"
    fontSize: 68px
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: -1.5px
  display-lg:
    fontFamily: "Rund Text, Inter, sans-serif"
    fontSize: 52px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -1px
  display-md:
    fontFamily: "Rund Text, Inter, sans-serif"
    fontSize: 38px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.5px
  display-sm:
    fontFamily: "Rund Text, Inter, sans-serif"
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.3px
  title-lg:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0
  title-md:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  title-sm:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  caption:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption-uppercase:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 1.5px
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  button:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  nav-link:
    fontFamily: "Apple Color Emoji, Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  xs: 3px
  sm: 5px
  md: 8px
  lg: 10px
  xl: 15px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 8px
  xs: 16px
  sm: 24px
  md: 32px
  lg: 48px
  xl: 64px
  xxl: 96px
  section: 192px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xl}"
    padding: 12px 20px
    height: 40px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.xl}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.muted}"
    rounded: "{rounded.xl}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.xl}"
    padding: 12px 20px
    height: 40px
    border: 1px solid {colors.hairline}
  button-text-link:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.button}"
  text-link:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 64px
  hero-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: 192px
  feature-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.title-md}"
    rounded: "{rounded.lg}"
    padding: 64px
  surface-card-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.title-md}"
    rounded: "{rounded.lg}"
    padding: 64px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 10px 14px
    height: 40px
    border: 1px solid {colors.hairline}
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    border: 1px solid {colors.primary}
  badge-pill:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 12px
  badge-accent:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.pill}"
    padding: 4px 12px
  cta-band:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.display-sm}"
    rounded: "{rounded.lg}"
    padding: 64px
  footer:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark-soft}"
    typography: "{typography.body-sm}"
    padding: 64px
---

## Overview

Betashares (betashares.com.au) presents a clean light-canvas interface. The base atmosphere is a **pure white canvas** (`{colors.canvas}` — #ffffff) carrying dark ink text (`{colors.ink}` — #09090a). Headlines run **Rund Text** at weight 500, paired with **Apple Color Emoji** for body and UI labels. Code and technical text use **JetBrains Mono**.

Brand voltage comes from the **white + coral pairing** — the primary accent (`{colors.primary}` — #fc4d16) appears on CTAs, links and key interactive moments, while darker contrast surfaces (`{colors.surface-dark}` — #09090a) provide the page's pacing rhythm for emphasis bands and the footer.

**Key characteristics:**
- Pure white canvas (#ffffff) with dark ink text (#09090a).
- Coral primary accent (#fc4d16) reserved for CTAs and interactive elements — active state darkens to #dc3703.
- Display and UI type share a two-family stack (Rund Text + Apple Color Emoji) for a coherent product voice.
- Border radius is hierarchical: `{rounded.xl}` (15px) for buttons and inputs, `{rounded.lg}` (10px) for content cards.
- Spacing runs on a 8px base grid; section rhythm at `{spacing.section}` (192px).
- Max content width ≈ 980px centered.

## Colors

### Brand & Accent
- **Primary** (`{colors.primary}` — #fc4d16): The signature coral accent. Use on primary CTA backgrounds, inline links, and focused-input borders. Observed directly in the site’s shipped CSS (button and link rules).
- **Primary Active** (`{colors.primary-active}` — #dc3703): Press / active-darker variant.
- **Primary Disabled** (`{colors.primary-disabled}` — #fed3c5): Desaturated, canvas-tinted disabled state.
- **Accent 1** (`{colors.accent-1}` — #0693e3): A secondary hue found in the shipped CSS. Use sparingly for highlights, status dots, or category tags.
- **Accent 2** (`{colors.accent-2}` — #00d084): A tertiary hue. Reserve for illustration strokes and small inline moments.

### Surface
- **Canvas** (`{colors.canvas}` — #ffffff): The default page floor. A neutral floor — clean and unobtrusive.
- **Surface Soft** (`{colors.surface-soft}` — #f9f6f4): Section dividers and soft band backgrounds — one step from canvas.
- **Surface Card** (`{colors.surface-card}` — #f8f6f4): Card backgrounds. Two steps from canvas; no shadow needed.
- **Surface Dark** (`{colors.surface-dark}` — #09090a): The contrast surface — emphasis bands, featured cards, footer.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` — #17171a): Elevated panels inside contrast bands.
- **Hairline** (`{colors.hairline}` — #ffffff): The 1px border tone. Borders should feel like an elevation step, not ink lines.

### Text
- **Ink** (`{colors.ink}` — #09090a): Headlines and primary text.
- **Body Strong** (`{colors.body-strong}` — #1d1d1e): Emphasized paragraphs, lead text.
- **Body** (`{colors.body}` — #353536): Default running text.
- **Muted** (`{colors.muted}` — #757576): Sub-headings, secondary labels.
- **Muted Soft** (`{colors.muted-soft}` — #989898): Captions, fine print.
- **On Primary** (`{colors.on-primary}` — #ffffff): Text on primary-filled elements.
- **On Dark** (`{colors.on-dark}` — #f5f5f5): Text on contrast surfaces.
- **On Dark Soft** (`{colors.on-dark-soft}` — #a2a2a3): Secondary text on contrast surfaces.

### Semantic
- **Success** (`{colors.success}` — #00d084): Positive status, confirmation.
- **Warning** (`{colors.warning}` — #fcb900): Caution states.
- **Error** (`{colors.error}` — #cf2e2e): Validation errors, destructive actions.

## Typography

### Font Family
Display: **Rund Text**. Body & UI: **Apple Color Emoji**. Code: **JetBrains Mono**.
Families observed in the shipped CSS / font links: `Rund Text`, `Rund Display`, `Material Symbols Outlined`, `Material Symbols Outlined Thick`, `Material Symbols Filled`, `Apple Color Emoji`, `Menlo`, `gform-icons-theme`.

Fallback stacks:
- Display: `Rund Text, Inter, sans-serif`
- Body: `Apple Color Emoji, Inter, -apple-system, sans-serif`
- Code: `JetBrains Mono, ui-monospace, monospace`

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 68px | 500 | 1.05 | -1.5px | Homepage h1, hero display |
| `{typography.display-lg}` | 52px | 500 | 1.1 | -1px | Section heads |
| `{typography.display-md}` | 38px | 500 | 1.15 | -0.5px | Sub-section heads |
| `{typography.display-sm}` | 30px | 500 | 1.2 | -0.3px | Card headlines, callouts |
| `{typography.title-lg}` | 22px | 500 | 1.3 | 0 | Plan/panel titles |
| `{typography.title-md}` | 18px | 500 | 1.4 | 0 | Card titles, intro paragraphs |
| `{typography.title-sm}` | 16px | 500 | 1.4 | 0 | Tile titles, list labels |
| `{typography.body-md}` | 14px | 400 | 1.55 | 0 | Default running text |
| `{typography.body-sm}` | 12px | 400 | 1.55 | 0 | Footer body, fine print |
| `{typography.caption}` | 13px | 500 | 1.4 | 0 | Badge labels, captions |
| `{typography.caption-uppercase}` | 12px | 500 | 1.4 | 1.5px | Category tags, NEW badges |
| `{typography.code}` | 14px | 400 | 1.6 | 0 | Code blocks |
| `{typography.button}` | 14px | 500 | 1 | 0 | Button labels |
| `{typography.nav-link}` | 14px | 500 | 1.4 | 0 | Top-nav menu items |

### Principles
Display sizes stay at weight 500. Headlines carry `letter-spacing: 0` in the source CSS — preserve it; tracking is part of the brand voice. Body type runs weight 400 for paragraphs and 500 for labels and buttons. When in doubt about emphasis: go larger before going bolder.

## Layout

### Spacing System
- **Base unit:** 8px.
- **Tokens:** `{spacing.xxs}` 8px · `{spacing.xs}` 16px · `{spacing.sm}` 24px · `{spacing.md}` 32px · `{spacing.lg}` 48px · `{spacing.xl}` 64px · `{spacing.xxl}` 96px · `{spacing.section}` 192px.
- **Section padding:** `{spacing.section}` (192px) between major bands.
- **Card internal padding:** `{spacing.xl}` (64px) for feature/content cards.
- **Raw spacing values observed:** 2px, 4px, 6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 22px, 24px.

### Grid & Container
- **Max content width:** ~980px centered.
- **Breakpoints found in CSS:** 320px · 330px · 337px · 360px · 374px · 375px · 376px · 380px · 381px · 389px · 390px · 400px · 420px · 424px · 425px · 430px · 479px · 480px · 501px · 570px · 639px · 640px · 641px · 699px · 760px · 766px · 767px · 768px · 960px · 961px · 983px · 992px · 1022px · 1023px · 1024px · 1025px · 1031px · 1041px · 1078px · 1100px · 1140px · 1150px · 1200px · 1279px · 1280px · 1309px · 1316px · 1344px · 1356px · 1366px · 1380px · 1400px · 1440px · 1920px · 1921px.
- Feature grids: 3-up desktop, 2-up tablet, 1-up mobile (standard collapse).

## Elevation & Depth

The most-used shadow in the shipped CSS is `rgba(9,9,10,.15) 0 5px 15px 0`. Apply it only to floating elements (dropdowns, modals, hover-elevated cards).

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Body sections, nav, hero |
| Hairline | 1px `{colors.hairline}` border | Inputs, outlined cards |
| Card | `{colors.surface-card}` background | Feature/content cards |
| Contrast | `{colors.surface-dark}` background | Emphasis bands, featured tiers, footer |

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 3px | Badge accents, tiny dropdowns |
| `{rounded.sm}` | 5px | Small inline buttons, menu items |
| `{rounded.md}` | 8px | Standard buttons, inputs, tabs |
| `{rounded.lg}` | 10px | Content cards |
| `{rounded.xl}` | 15px | Hero containers, marquee components |
| `{rounded.pill}` | 9999px (pill) | Badge pills, tags |
| `{rounded.full}` | 9999px (pill) | Avatars, circular icon buttons |

Raw radius values observed in CSS: 3px, 4px, 5px, 6px, 8px, 10px, 12px, 15px, plus pill (9999px / 50%).

## Components

**`top-nav`** — Canvas-colored bar, 64px tall. Wordmark left, horizontal menu center/right, primary CTA button at far right in `{component.button-primary}`.

**`button-primary`** — The signature CTA. Background `{colors.primary}`, text `{colors.on-primary}`, `{typography.button}`, padding 12px 20px, height 40px, rounded `{rounded.xl}`. Active state darkens to `{colors.primary-active}`.

**`button-secondary`** — Canvas background, `{colors.ink}` text, 1px `{colors.hairline}` border. Same geometry as primary.

**`text-link`** — Inline links in `{colors.primary}`.

**`hero-band`** — Canvas hero with display headline in `{typography.display-xl}`, sub-headline in `{typography.title-md}` at `{colors.body}`, button row below. Vertical padding `{spacing.section}`.

**`feature-card`** — Grid card. Background `{colors.surface-card}`, rounded `{rounded.lg}`, padding `{spacing.xl}`. Icon or kicker on top, `{typography.title-md}` headline, `{typography.body-md}` description.

**`surface-card-dark`** — Contrast card for featured content. Background `{colors.surface-dark}`, text `{colors.on-dark}`, rounded `{rounded.lg}`.

**`text-input`** — Canvas background, 1px hairline border, rounded `{rounded.xl}`, height 40px. Focus shifts the border to `{colors.primary}`.

**`badge-pill`** / **`badge-accent`** — Pill labels. Neutral pills use `{colors.surface-card}`; accent pills fill with `{colors.primary}` and use `{typography.caption-uppercase}`.

**`cta-band`** — Pre-footer call-to-action. Full-width `{colors.primary}` fill, `{colors.on-primary}` type in `{typography.display-sm}`, an inverted (canvas) button inside.

**`footer`** — `{colors.surface-dark}` background, `{colors.on-dark-soft}` body text, multi-column link list, 64px vertical padding.

## Do's and Don'ts

### Do
- Anchor every page on `{colors.canvas}` (#ffffff) — the exact tint is part of the brand.
- Reserve `{colors.primary}` for primary CTAs, links, and focus states. Scarcity keeps it powerful.
- Use Rund Text for every display headline and Apple Color Emoji for body/UI. The split is the brand voice.
- Alternate canvas bands with `{colors.surface-dark}` contrast bands to pace long pages.
- Keep `{spacing.section}` (192px) rhythm between major bands.

### Don't
- Don't substitute a different accent hue — the coral (#fc4d16) is the brand voltage.
- Don't paint the accent everywhere; it should stay scarce on individual elements.
- Don't introduce a decorative display face — it would break the brand voice.
- Don't stack two identical surface tones in consecutive bands; alternate for rhythm.
- Don't add shadows where surface contrast already provides depth.

## Responsive Behavior

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Hamburger nav; display-xl scales ~50%; grids 1-up; footer columns stack |
| Tablet | 768–1024px | Nav stays horizontal; grids 2-up |
| Desktop | 1024–1440px | Full nav; grids 3-up; container ~980px |
| Wide | > 1440px | More outer whitespace; content max-width capped |

Breakpoints observed in the source CSS: 320px · 330px · 337px · 360px · 374px · 375px · 376px · 380px · 381px · 389px · 390px · 400px · 420px · 424px · 425px · 430px · 479px · 480px · 501px · 570px · 639px · 640px · 641px · 699px · 760px · 766px · 767px · 768px · 960px · 961px · 983px · 992px · 1022px · 1023px · 1024px · 1025px · 1031px · 1041px · 1078px · 1100px · 1140px · 1150px · 1200px · 1279px · 1280px · 1309px · 1316px · 1344px · 1356px · 1366px · 1380px · 1400px · 1440px · 1920px · 1921px.

## Iteration Guide

1. Focus on ONE component at a time. Reference its YAML key (`{component.feature-card}`).
2. Variants (`-active`, `-disabled`, `-focused`) live as separate entries under `components:`.
3. Use `{token.refs}` everywhere — never inline hex.
4. Default and Active/Pressed states only; don't invent hover styling.
5. When in doubt about emphasis: bigger type before bolder weight.

## Known Gaps

- This document was generated automatically from betashares.com.au's shipped HTML/CSS on 2026-10-25. Colors and fonts rendered exclusively by JavaScript (canvas, WebGL, CSS-in-JS injected at runtime) may not be captured.
- Accent selection is frequency-and-context based; verify the primary against the live site’s main CTA.
- Licensed fonts may not be freely available; substitute with open-source near-matches if needed.
- Animation timings, hover choreography, and imagery art direction are out of scope for static extraction.
- Semantic colors (success/warning/error) are best-effort — confirm against real form validation states.
