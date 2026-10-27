import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// The one place the breakpoint scale is defined (DESIGN.md "Layout"). Replaces Chakra's sm/md/lg/xl/2xl.
// Passed as one config, not merged over `defaultConfig`: merging would keep Chakra's own breakpoints beside ours.
export const breakpoints = {
  mobileLarge: '560px',
  tablet: '760px',
  tabletLarge: '895px',
  desktop: '1030px',
  desktopLarge: '1200px',
  desktopXLarge: '1400px',
};

const slots = (name: keyof NonNullable<NonNullable<typeof defaultConfig.theme>['slotRecipes']>) => defaultConfig.theme?.slotRecipes?.[name]?.slots ?? [];

// Every value from DESIGN.md lives here; components only name the semantic tokens below.
// The values are copied from the live Betashares fund page, including its WCAG failures (DESIGN.md lists them).
export const system = createSystem(
  { ...defaultConfig, theme: { ...defaultConfig.theme, breakpoints } },
  defineConfig({
    globalCss: {
      // Makes `colorPalette` default to the brand, so solid buttons, checkboxes and focus rings pick it up.
      html: { colorPalette: 'brand' },
      body: { fontSize: '16px', lineHeight: '1.4' },
      // Every interactive element gets the same ring; Chakra's own recipes already read it from brand.focusRing.
      ':focus-visible': { outline: '2px solid', outlineColor: 'brand.accent', outlineOffset: '2px' },
    },
    theme: {
      tokens: {
        colors: {
          // The brand orange is fills, text and the focus ring alike; white text on it is a known exception.
          brand: { accent: { value: '#fc4d16' }, solid: { value: '#fc4d16' }, solidHover: { value: '#e8420f' }, subtle: { value: '#fff1ec' } },
          ink: { value: '#09090a' },
          muted: { value: '#5f5964' },
          // The page is warm grey and cards are white (DESIGN.md "Colour").
          canvas: { value: '#f0edeb' },
          surfaceCard: { value: '#ffffff' },
          hairline: { value: '#e7e7e7' },
          // For dividers sitting on the canvas, where hairline is nearly invisible.
          hairlineCanvas: { value: '#cccccc' },
          controlBorder: { value: '#dddddd' },
          success: { value: '#177745' },
          warning: { value: '#9a5b00' },
          error: { value: '#c62828' },
        },
        // Hotlinked in index.html; Inter covers them until they load.
        fonts: {
          body: { value: '"Rund Text", Inter, -apple-system, system-ui, sans-serif' },
          heading: { value: '"Rund Display", "Rund Text", Inter, -apple-system, system-ui, sans-serif' },
        },
        radii: {
          input: { value: '5px' },
          button: { value: '9999px' },
          // Results card: card on phones, cardLarge from desktop.
          card: { value: '15px' },
          cardLarge: { value: '30px' },
          // Global because FilterRail asks for `borderRadius="lg"` by prop; it is the only `lg` user and is a card.
          lg: { value: '15px' },
        },
        // Desktop container and mobile page gutter (DESIGN.md "Layout"); the search field has two heights, and the Search button inside it is
        // the field height less an 8px inset on each side; pill is the ticker pill's.
        sizes: { container: { value: '1030px' }, field: { value: '48px' }, fieldLarge: { value: '62px' }, pill: { value: '22px' }, fieldInner: { value: '32px' }, fieldInnerLarge: { value: '46px' } },
        spacing: { gutter: { value: '16px' }, indent: { value: '16px' } },
        shadows: { floating: { value: 'rgba(9,9,10,.15) 0 5px 15px 0' } },
      },
      semanticTokens: {
        colors: {
          // The slots Chakra reads for `colorPalette="brand"`; solid and subtle come from the plain tokens above.
          brand: {
            contrast: { value: '#ffffff' },
            fg: { value: '{colors.brand.solid}' },
            muted: { value: '{colors.brand.subtle}' },
            emphasized: { value: '{colors.brand.subtle}' },
            focusRing: { value: '{colors.brand.accent}' },
            border: { value: '{colors.hairline}' },
          },
          pill: { bg: { value: '{colors.brand.solid}' }, fg: { value: '#ffffff' } },
          bar: { bg: { value: '{colors.brand.solid}' }, fg: { value: '#ffffff' } },
          tag: { bg: { value: '{colors.canvas}' }, fg: { value: '{colors.ink}' }, border: { value: '{colors.muted}' } },
          link: { DEFAULT: { value: '{colors.brand.solid}' }, hover: { value: '{colors.brand.solidHover}' } },
          icon: { value: '{colors.brand.solid}' },
          divider: { DEFAULT: { value: '{colors.hairline}' }, canvas: { value: '{colors.hairlineCanvas}' } },
          helper: { value: '{colors.muted}' },
          results: { value: '{colors.surfaceCard}' },
          bg: {
            DEFAULT: { value: '{colors.canvas}' },
            panel: { value: '{colors.surfaceCard}' },
            subtle: { value: '{colors.canvas}' },
            muted: { value: '{colors.surfaceCard}' },
            emphasized: { value: '{colors.canvas}' },
          },
          fg: {
            DEFAULT: { value: '{colors.ink}' },
            muted: { value: '{colors.muted}' },
            error: { value: '{colors.error}' },
          },
          border: { DEFAULT: { value: '{colors.hairline}' }, emphasized: { value: '{colors.controlBorder}' }, error: { value: '{colors.error}' } },
        },
        // Components ask for `rounded="l2"` (insight cards) by prop, so l2 has to be global; the drawer and the rest name `card` directly.
        radii: { l2: { value: '{radii.card}' } },
      },
      textStyles: {
        // The page title: Rund Display, scaled down for tablet and phone.
        displayLg: {
          value: {
            fontSize: { base: '44px', tablet: '56px', desktop: '68px' },
            lineHeight: { base: '42px', tablet: '54px', desktop: '66px' },
            letterSpacing: '-0.02em',
            fontWeight: '500',
          },
        },
        titleLg: { value: { fontSize: '22px', lineHeight: '1.3', fontWeight: '500' } },
        titleMd: { value: { fontSize: '18px', lineHeight: '1.4', fontWeight: '500' } },
        titleSm: { value: { fontSize: '16px', lineHeight: '1.4', fontWeight: '500' } },
        bodyMd: { value: { fontSize: '16px', lineHeight: '1.4', fontWeight: '400' } },
        bodySm: { value: { fontSize: '14px', lineHeight: '20px', fontWeight: '400' } },
        caption: { value: { fontSize: '14px', lineHeight: '20px', fontWeight: '500' } },
      },
      recipes: {
        heading: { base: { color: 'ink' }, variants: { size: { '2xl': { textStyle: 'displayLg', color: 'brand.solid' }, md: { textStyle: 'titleLg' }, sm: { textStyle: 'titleSm' } } } },
        // The button system. TERTIARY is `tertiary`: the result-tag colours on a 32px pill (the applied-filter chips). PRIMARY is `solid` (orange fill and border, white text, pill). SECONDARY is `outline` (white fill, ink text,
        // muted border like the gear, pill, 32px): components pick a variant and carry no colour or border props. Disabled secondary buttons keep full
        // opacity (a faded one looked broken) and show the not-allowed cursor.
        button: {
          base: { borderRadius: 'button' },
          variants: {
            variant: {
              solid: {
                bg: 'brand.solid',
                borderColor: 'brand.solid',
                _hover: { bg: 'brand.solidHover', borderColor: 'brand.solidHover' },
                _expanded: { bg: 'brand.solidHover', borderColor: 'brand.solidHover' },
              },
              outline: { bg: 'bg.panel', color: 'ink', borderColor: 'muted', _hover: { bg: 'bg.emphasized' }, _expanded: { bg: 'bg.emphasized' }, _disabled: { opacity: 1, cursor: 'not-allowed' } },
              tertiary: { bg: 'tag.bg', color: 'tag.fg', borderColor: 'tag.border', _hover: { bg: 'bg.panel' }, _expanded: { bg: 'bg.panel' } },
              ghost: { color: 'ink', _hover: { bg: 'bg.emphasized' }, _expanded: { bg: 'bg.emphasized' } },
            },
            size: { sm: { h: '8' }, md: { h: '42px' } },
          },
        },
        // md is the default size; the search field sets its own height.
        input: { base: { borderRadius: 'input' }, variants: { size: { md: { '--input-height': 'sizes.field' } }, variant: { outline: { bg: 'bg.panel', borderColor: 'border.emphasized' } } } },
        // subtle is the orange pill; outline is the neutral result tag (grey tint, ink text, thin muted border).
        badge: { base: { borderRadius: 'full' }, variants: { size: { sm: { textStyle: 'caption' }, md: { textStyle: 'caption' } }, variant: { subtle: { bg: 'pill.bg', color: 'pill.fg' }, outline: { bg: 'tag.bg', color: 'tag.fg', shadow: 'none', borderWidth: '1px', borderColor: 'tag.border', fontWeight: 'medium' } } } },
      },
      slotRecipes: {
        // The drawer is a floating layer: DESIGN.md radius and shadow.
        drawer: { slots: slots('drawer'), base: { positioner: { padding: '2.5' }, content: { borderRadius: 'card', boxShadow: 'floating' } } },
        // The combobox styles its input slot over the Input recipe (transparent, hairline border, 40px), so the search field is restated here:
        // white on the grey canvas, no visible border until focus.
        combobox: {
          slots: slots('combobox'),
          base: { content: { shadow: 'floating' }, input: { borderRadius: 'input' }, item: { ps: 'calc(var(--combobox-item-padding-x) + {spacing.indent})', _highlighted: { bg: 'brand.subtle' } } },
          variants: { variant: { outline: { input: { bg: 'bg.panel', borderColor: 'transparent' } } }, size: { md: { root: { '--combobox-input-height': 'sizes.field' } } } },
        },
        nativeSelect: { slots: slots('nativeSelect'), base: { field: { borderRadius: 'input' } }, variants: { variant: { outline: { field: { bg: 'bg.panel', borderColor: 'border.emphasized' } } } } },
        // Checked controls fill from the palette's solid colour, which is the brand orange with a white mark.
        checkbox: { slots: slots('checkbox'), base: { control: { borderRadius: 'input', bg: 'bg.panel' }, label: { userSelect: 'text', color: 'fg.muted' } } },
        radioGroup: { slots: slots('radioGroup'), base: { itemText: { color: 'fg.muted' } } },
        // Chakra sets `user-select: none` on these labels, which stops people selecting and copying the text.
        field: { slots: slots('field'), base: { label: { userSelect: 'text' } } },
        switch: { slots: slots('switch'), base: { label: { userSelect: 'text' } } },
      },
    },
  }),
);

// Chakra's `typegen` CLI would write these names into node_modules; this makes the type-check see them without it.
declare module '../node_modules/@chakra-ui/react/dist/types/styled-system/generated/conditions.gen' {
  interface Conditions {
    mobileLarge: string;
    tablet: string;
    tabletLarge: string;
    desktop: string;
    desktopLarge: string;
    desktopXLarge: string;
  }
}
