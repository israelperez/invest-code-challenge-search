import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { system } from './theme';

// DESIGN.md "Layout": the scale replaces Chakra's sm..2xl, and `base` is implied.
it('has exactly the DESIGN.md breakpoint scale', () => {
  expect(system._config.theme?.breakpoints).toEqual({
    mobileLarge: '560px',
    tablet: '760px',
    tabletLarge: '895px',
    desktop: '1030px',
    desktopLarge: '1200px',
    desktopXLarge: '1400px',
  });
  expect(Object.keys(system.breakpoints.values)).not.toContain('md');
});

// Chakra's own recipes set `user-select: none` on these labels, so people could not select or copy them.
it('lets people select field, checkbox and switch labels', () => {
  const recipes = system._config.theme?.slotRecipes as Record<string, { base?: { label?: { userSelect?: string } } }>;
  for (const name of ['field', 'checkbox', 'switch']) expect(recipes[name].base?.label?.userSelect).toBe('text');
});

// Resolves a colour/radius/shadow token to its literal by following `{category.name}` references in the theme config.
type Tok = { value?: unknown };
const tree = (o: unknown, path: string[]): Tok | undefined => path.reduce<any>((n, k) => n?.[k], o);
function resolve(category: string, name: string): string {
  const theme = system._config.theme as any;
  const tok = tree(theme.semanticTokens?.[category], name.split('.')) ?? tree(theme.tokens?.[category], name.split('.'));
  const raw = (tok?.value as any)?._light ?? tok?.value;
  if (typeof raw !== 'string') throw new Error(`no ${category} token ${name}`);
  const ref = /^\{(\w+)\.(.+)\}$/.exec(raw);
  return ref ? resolve(ref[1], ref[2]) : raw;
}
const color = (name: string) => (name.startsWith('#') ? name : resolve('colors', name));

// DESIGN.md "Colour": values copied from the live Betashares fund page.
it('maps every DESIGN.md colour token', () => {
  expect(color('brand.accent')).toBe('#fc4d16');
  expect(color('brand.solid')).toBe('#fc4d16');
  expect(color('brand.solidHover')).toBe('#e8420f');
  expect(color('brand.subtle')).toBe('#fff1ec');
  expect(color('ink')).toBe('#09090a');
  expect(color('muted')).toBe('#5f5964');
  expect(color('canvas')).toBe('#f0edeb');
  expect(color('surfaceCard')).toBe('#ffffff');
  expect(color('hairline')).toBe('#e7e7e7');
  expect(color('controlBorder')).toBe('#dddddd');
  expect(color('success')).toBe('#177745');
  expect(color('warning')).toBe('#9a5b00');
  expect(color('error')).toBe('#c62828');
});

// The components only use Chakra's semantic tokens, so these must land on the brand.
it('points Chakra semantic tokens and the default palette at the brand', () => {
  expect(color('bg.DEFAULT')).toBe('#f0edeb');
  expect(color('bg.panel')).toBe('#ffffff');
  expect(color('bg.muted')).toBe('#ffffff');
  expect(color('bg.emphasized')).toBe('#f0edeb');
  expect(color('fg.DEFAULT')).toBe('#09090a');
  expect(color('border.DEFAULT')).toBe('#e7e7e7');
  expect(color('border.emphasized')).toBe('#dddddd');
  expect(color('fg.muted')).toBe('#5f5964');
  expect(color('fg.error')).toBe('#c62828');
  expect(color('brand.contrast')).toBe('#ffffff');
  expect(color('brand.focusRing')).toBe('#fc4d16');
  expect((system._config.globalCss as any).html.colorPalette).toBe('brand');
});

it('styles the page title, buttons, badges and checkboxes from the target', () => {
  const t = system._config.theme as any;
  expect(t.recipes.heading.variants.size['2xl']).toMatchObject({ color: 'brand.solid', textStyle: 'displayLg' });
  expect(t.textStyles.displayLg.value).toMatchObject({
    fontSize: { base: '44px', tablet: '56px', desktop: '68px' },
    lineHeight: { base: '42px', tablet: '54px', desktop: '66px' },
    letterSpacing: '-0.02em',
    fontWeight: '500',
  });
  expect(t.recipes.button.base.borderRadius).toBe('button');
  expect(resolve('radii', 'button')).toBe('9999px');
  expect(t.recipes.button.variants.variant.solid).toMatchObject({ bg: 'brand.solid', borderColor: 'brand.solid', _hover: { bg: 'brand.solidHover', borderColor: 'brand.solidHover' } });
  // PRIMARY is solid, SECONDARY is outline (also the faded-disabled fix); components carry no colour or border props for either.
  expect(t.recipes.button.variants.variant.outline).toMatchObject({ bg: 'bg.panel', color: 'ink', borderColor: 'muted', _disabled: { opacity: 1, cursor: 'not-allowed' } });
  expect(t.recipes.button.variants.variant.tertiary).toMatchObject({ bg: 'tag.bg', color: 'tag.fg', borderColor: 'tag.border' });
  expect(t.recipes.button.variants.size).toMatchObject({ sm: { h: '8' }, md: { h: '42px' } });
  expect(t.recipes.badge.variants.variant.subtle).toMatchObject({ bg: 'pill.bg', color: 'pill.fg' });
  expect(t.slotRecipes.combobox.variants.variant.outline.input).toMatchObject({ bg: 'bg.panel', borderColor: 'transparent' });
  expect(t.slotRecipes.checkbox.base.control).toMatchObject({ borderRadius: 'input', bg: 'bg.panel' });
});

// Tokens for the target look; components name these instead of hex.
it('names the target look: pills, chips, bar, links, icons, dividers, results surface', () => {
  expect(color('pill.bg')).toBe('#fc4d16');
  expect(color('pill.fg')).toBe('#ffffff');
  expect(color('tag.bg')).toBe('#f0edeb');
  expect(color('tag.fg')).toBe('#09090a');
  expect(color('tag.border')).toBe('#5f5964');
  expect(color('bar.bg')).toBe('#fc4d16');
  expect(color('bar.fg')).toBe('#ffffff');
  expect(color('link.DEFAULT')).toBe('#fc4d16');
  expect(color('link.hover')).toBe('#e8420f');
  expect(color('icon')).toBe('#fc4d16');
  expect(color('divider.DEFAULT')).toBe('#e7e7e7');
  expect(color('divider.canvas')).toBe('#cccccc');
  expect(color('helper')).toBe('#5f5964');
  expect(color('results')).toBe('#ffffff');
});

it('has the page container width, gutter, radii and search field heights', () => {
  expect(resolve('sizes', 'container')).toBe('1030px');
  expect(resolve('spacing', 'gutter')).toBe('16px');
  expect(resolve('radii', 'input')).toBe('5px');
  expect(resolve('radii', 'card')).toBe('15px');
  expect(resolve('radii', 'cardLarge')).toBe('30px');
  expect(resolve('sizes', 'field')).toBe('48px');
  expect(resolve('sizes', 'fieldLarge')).toBe('62px');
  expect(resolve('sizes', 'pill')).toBe('22px');
  expect(resolve('sizes', 'fieldInner')).toBe('32px');
  expect(resolve('sizes', 'fieldInnerLarge')).toBe('46px');
});

// WCAG 2.x relative luminance and contrast ratio.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(color(a)), lum(color(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Chakra draws disabled controls at 50% opacity and placeholders at fg.muted/80; blended over white, as the browser shows them.
const mixOverWhite = (hex: string, alpha: number) => '#' + [1, 3, 5].map((i) => Math.round(alpha * parseInt(hex.slice(i, i + 2), 16) + (1 - alpha) * 255).toString(16).padStart(2, '0')).join('');
const disabledText = mixOverWhite(color('muted'), 0.5);
const placeholderText = mixOverWhite(color('muted'), 0.8);

// Known WCAG exceptions copied from the target page on purpose (Israel, #21); fixing them is the next task.
// One entry per issue type, matching the table in DESIGN.md. Each pair must still fail by about the ratio shown, so the list cannot
// go stale: fix one, then delete it here and in DESIGN.md.
const KNOWN_EXCEPTIONS: Record<string, [fg: string, bg: string, ratio: number, needs: number][]> = {
  'white text on brand orange': [['pill.fg', 'brand.solid', 3.38, 4.5]],
  'orange text and icons on the light grey, and orange links on white': [['brand.solid', 'canvas', 2.9, 3], ['icon', 'canvas', 2.9, 3], ['brand.solid', 'surfaceCard', 3.38, 4.5]],
  'light grey text on light backgrounds (disabled filter options, placeholder)': [[disabledText, 'surfaceCard', 2.24, 4.5], [placeholderText, 'surfaceCard', 4.19, 4.5]],
  'checkbox, radio and select outlines too light': [['controlBorder', 'surfaceCard', 1.36, 3], ['controlBorder', 'canvas', 1.17, 3]],
  'white inputs with no border on the grey canvas': [['surfaceCard', 'canvas', 1.17, 3]],
  'hover orange with white text': [['pill.fg', 'brand.solidHover', 4.03, 4.5], ['link.hover', 'surfaceCard', 4.03, 4.5]],
};
describe.each(Object.entries(KNOWN_EXCEPTIONS))('known exception: %s', (_issue, pairs) => {
  it.each(pairs)('%s on %s is about %s:1, below the %s needed', (fg, bg, expected, needs) => {
    expect(ratio(fg, bg)).toBeCloseTo(expected, 1);
    expect(ratio(fg, bg)).toBeLessThan(needs);
  });
});

it('known exception: text below 16px (body-sm and caption are 14px; 12px is used for raw-value hints)', () => {
  const styles = (system._config.theme as any).textStyles;
  for (const name of ['bodySm', 'caption']) expect(parseInt(styles[name].value.fontSize)).toBeLessThan(16);
});

it.each(['canvas', 'surfaceCard'])('ink, muted, success, warning and error have at least 4.5:1 on %s', (bg) => {
  for (const fg of ['ink', 'muted', 'success', 'warning', 'error']) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
});

it('has readable text on the tag, chip and gear fills', () => {
  expect(ratio('tag.fg', 'tag.bg')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('ink', 'surfaceCard')).toBeGreaterThanOrEqual(4.5);
  expect(ratio('ink', 'brand.subtle')).toBeGreaterThanOrEqual(4.5);
});

it('keeps non-text accents, the gear border and the help text readable', () => {
  expect(ratio('brand.accent', 'surfaceCard')).toBeGreaterThanOrEqual(3);
  expect(ratio('muted', 'canvas')).toBeGreaterThanOrEqual(3);
  expect(ratio('helper', 'canvas')).toBeGreaterThanOrEqual(4.5);
  expect(ratio('icon', 'results')).toBeGreaterThanOrEqual(3);
});

it('keeps dividers decorative, the canvas one visible', () => {
  expect(ratio('divider.DEFAULT', 'results')).toBeLessThan(3);
  expect(ratio('divider.canvas', 'canvas')).toBeLessThan(3);
  expect(ratio('divider.canvas', 'canvas')).toBeGreaterThanOrEqual(1.2);
});

// DESIGN.md "Typography": the fonts are the target's, hotlinked from its host.
it('uses Rund Text for body, Rund Display for headings, both with an Inter fallback', () => {
  expect(resolve('fonts', 'body')).toBe('"Rund Text", Inter, -apple-system, system-ui, sans-serif');
  expect(resolve('fonts', 'heading')).toBe('"Rund Display", "Rund Text", Inter, -apple-system, system-ui, sans-serif');
});

it('hotlinks Rund Text and Rund Display with font-display swap and commits no font files', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const faces = html.match(/@font-face\s*{[^}]*}/g) ?? [];
  const base = 'https://www.betashares.com.au/wp-content/themes/betashares/fonts/';
  const expected = [
    ['Rund Text', 300, 'RundText-Light'],
    ['Rund Text', 400, 'RundText-Regular'],
    ['Rund Text', 500, 'RundText-Medium'],
    ['Rund Text', 600, 'RundText-SemiBold'],
    ['Rund Text', 700, 'RundText-Bold'],
    ['Rund Display', 500, 'RundDisplay-Medium'],
  ] as const;
  for (const [family, weight, file] of expected) {
    const face = faces.find((f) => f.includes(`font-family: "${family}"`) && f.includes(`font-weight: ${weight}`));
    expect(face, `${family} ${weight}`).toBeDefined();
    expect(face).toContain(`${base}${file}.woff2`);
    expect(face).toContain('font-display: swap');
  }
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  expect(tracked.filter((f) => /\.(woff2?|ttf|otf)$/i.test(f))).toEqual([]);
});

// Every token group and recipe DESIGN.md names must exist in the theme with its value.
it('has every DESIGN.md token group and recipe', () => {
  const t = system._config.theme as any;
  expect(Object.keys(t.breakpoints)).toEqual(['mobileLarge', 'tablet', 'tabletLarge', 'desktop', 'desktopLarge', 'desktopXLarge']);
  for (const [name, hex] of Object.entries({ 'pill.bg': '#fc4d16', 'bar.bg': '#fc4d16', 'tag.border': '#5f5964', 'divider.DEFAULT': '#e7e7e7', 'divider.canvas': '#cccccc', helper: '#5f5964', results: '#ffffff', 'link.DEFAULT': '#fc4d16', icon: '#fc4d16', 'border.error': '#c62828' })) expect(color(name), name).toBe(hex);
  expect(resolve('radii', 'l2')).toBe('15px');
  expect(resolve('radii', 'lg')).toBe('15px');
  expect(resolve('shadows', 'floating')).toBe('rgba(9,9,10,.15) 0 5px 15px 0');
  expect(Object.keys(t.textStyles)).toEqual(expect.arrayContaining(['displayLg', 'titleLg', 'titleMd', 'titleSm', 'bodyMd', 'bodySm', 'caption']));
  const style = (n: string) => t.textStyles[n].value;
  expect(style('titleLg')).toMatchObject({ fontSize: '22px', lineHeight: '1.3', fontWeight: '500' });
  expect(style('titleMd')).toMatchObject({ fontSize: '18px', lineHeight: '1.4', fontWeight: '500' });
  expect(style('titleSm')).toMatchObject({ fontSize: '16px', lineHeight: '1.4', fontWeight: '500' });
  expect(style('bodyMd')).toMatchObject({ fontSize: '16px', lineHeight: '1.4', fontWeight: '400' });
  expect(style('bodySm')).toMatchObject({ fontSize: '14px', lineHeight: '20px', fontWeight: '400' });
  expect(style('caption')).toMatchObject({ fontSize: '14px', lineHeight: '20px', fontWeight: '500' });
  expect(Object.keys(t.recipes)).toEqual(expect.arrayContaining(['badge', 'button', 'heading', 'input']));
  expect(Object.keys(t.slotRecipes)).toEqual(expect.arrayContaining(['checkbox', 'radioGroup', 'combobox', 'drawer', 'field', 'nativeSelect', 'switch']));
  expect(t.recipes.input.base.borderRadius).toBe('input');
  expect(t.recipes.input.variants.size.md['--input-height']).toBe('sizes.field');
  expect(t.slotRecipes.nativeSelect.base.field.borderRadius).toBe('input');
  expect(t.slotRecipes.drawer.base.positioner.padding).toBe('2.5');
  expect(t.slotRecipes.combobox.base.content.shadow).toBe('floating');
  // Options sit one indent in from their group title, so a heading reads apart from an item (the title keeps the plain item padding).
  expect(resolve('spacing', 'indent')).toBe('16px');
  expect(t.slotRecipes.combobox.base.item.ps).toContain('{spacing.indent}');
  expect(t.slotRecipes.combobox.base.itemGroupLabel?.ps).toBeUndefined();
  expect(t.slotRecipes.combobox.variants.size.md.root['--combobox-input-height']).toBe('sizes.field');
  expect(t.slotRecipes.radioGroup.base.itemText.color).toBe('fg.muted');
  expect(t.slotRecipes.checkbox.base.label).toMatchObject({ userSelect: 'text', color: 'fg.muted' });
  expect(t.slotRecipes.field.base.label.userSelect).toBe('text');
  expect(t.slotRecipes.nativeSelect.variants.variant.outline.field).toMatchObject({ bg: 'bg.panel', borderColor: 'border.emphasized' });
  expect(t.recipes.input.variants.variant.outline).toMatchObject({ bg: 'bg.panel', borderColor: 'border.emphasized' });
  expect(t.recipes.badge.variants.variant.outline).toMatchObject({ bg: 'tag.bg', color: 'tag.fg', borderColor: 'tag.border' });
  expect(t.recipes.heading.variants.size).toMatchObject({ md: { textStyle: 'titleLg' }, sm: { textStyle: 'titleSm' } });
  const css = system._config.globalCss as any;
  expect(css.body).toMatchObject({ fontSize: '16px', lineHeight: '1.4' });
});
