// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { doc, fakeApi, problemsWrapper, renderApp, rows, search } from '../../tests/component/app-harness';
import { ResultRow } from './ResultRow';

afterEach(cleanup);
// jsdom drops Chakra's @layer rules and var() values, so read the rule emotion wrote for the element's class instead.
const css = () => Array.from(document.querySelectorAll('style'), (s) => s.textContent).join('\n');
const rules = (el: Element) => [...el.classList].flatMap((c) => [...css().matchAll(new RegExp(`\\.${c}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1])).join(';');
const all = (el: Element, prop: string) => [...rules(el).matchAll(new RegExp(`(?:^|[;\\s])${prop}:([^;]*)`, 'g'))].map((m) => m[1].trim());
const style = (el: Element, prop: string) => new RegExp(`(?:^|[;\\s])${prop}:([^;]*)`).exec(rules(el))?.[1].trim() ?? '';

// The target look is carried by theme tokens; these check the components name them.
it('renders the page title in brand.solid, the search button as tall as the input, and the ticker as a pill', async () => {
  renderApp(fakeApi());
  expect(style(screen.getByRole('heading', { level: 1 }), 'color')).toContain('brand-solid');
  expect(style(screen.getByRole('button', { name: 'Search' }), 'height')).toContain('sizes-field-inner');
  expect(style(screen.getByRole('button', { name: 'Search' }), 'font-size')).toContain('font-sizes-md');
  expect(style(screen.getByLabelText('Search shares and ETFs'), 'height')).toContain('sizes-field');
  await search('a');
  const row = rows()[0] as HTMLElement;
  const ticker = row.querySelector('p')!;
  expect(style(ticker, 'background')).toContain('pill-bg');
  expect(style(ticker, 'color')).toContain('pill-fg');
  expect(style(ticker, 'font-weight')).not.toBe('var(--chakra-font-weights-semibold)');
  expect(style(row.parentElement!, 'background')).toContain('results');
  expect(style(row, 'border-color')).toContain('divider-canvas');
  expect(style(row, 'align-items')).toBe('flex-start');
});

it('draws the search input white with no visible border, whichever recipe styles it', () => {
  renderApp(fakeApi());
  const input = screen.getByLabelText('Search shares and ETFs');
  // The combobox slot recipe styles this input too; none of its declarations may fall back to a transparent fill. (The borderless look is asserted in theme.test.ts and was checked in a browser: Chakra's cascade between the two recipes is not visible to jsdom.)
  for (const v of all(input, 'background')) expect(v).toContain('bg-panel');
  expect(all(input, 'background').length).toBeGreaterThan(0);
  expect(style(input.closest('[data-scope="combobox"][data-part="root"]')!, '--combobox-input-height')).toContain('sizes-field');
});

it('has the orange top strip and a white round gear button with a recolourable icon', () => {
  renderApp(fakeApi());
  const strip = screen.getByText('Israel Perez - Assessment').parentElement!;
  expect(style(strip, 'background')).toContain('bar-bg');
  expect(style(strip, 'color')).toContain('bar-fg');
  const header = screen.getByRole('banner');
  expect(style(header, 'border-color')).toContain('divider-canvas');
  expect(style(header, 'border-bottom-width')).toBe('1px');
  const gear = screen.getByRole('button', { name: 'Open settings' });
  // The target's round icon button: white fill, ink icon, muted 1px border for the grey canvas.
  expect(style(gear, 'background')).toContain('bg-panel');
  expect(style(gear, 'color')).toContain('ink');
  expect(style(gear, 'border-color')).toContain('muted');
  expect(style(gear, 'width')).toBe(style(gear, 'height'));
  expect(gear.querySelector('img')).toBeNull();
  expect(style(gear.querySelector('svg')!, 'fill')).toBe('currentColor');
});

it('puts the Search button inside the field, after the input and the clear button', () => {
  renderApp(fakeApi());
  const input = screen.getByLabelText('Search shares and ETFs');
  const control = input.parentElement!;
  const order = [...control.querySelectorAll('input, button')].map((e) => e.getAttribute('aria-label') ?? e.textContent);
  expect(order).toEqual(['', 'Clear search', 'Search']);
  expect(style(screen.getByText('Search shares and ETFs'), 'font-weight')).toContain('medium');
});

it('styles result tags as neutral outline badges, apart from the orange ticker pill', () => {
  const { container } = render(<ResultRow instrument={{ ...doc('X:AU'), is_betashares: true }} />, { wrapper: problemsWrapper() });
  const tag = [...container.querySelectorAll('span')].find((e) => e.textContent === 'Betashares')!;
  expect(style(tag, 'background')).toContain('tag-bg');
  expect(style(tag, 'color')).toContain('tag-fg');
  expect(style(tag, 'border-color')).toContain('tag-border');
  expect(style(container.querySelector('p')!, 'background')).toContain('pill-bg');
});

it('renders every filter button with the secondary look from the theme, with no overrides', async () => {
  renderApp(fakeApi());
  await search('a');
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  const buttons = [await screen.findByRole('button', { name: 'Clear filters' }), await screen.findByRole('button', { name: /^Show all \d/ }), await screen.findByRole('button', { name: /^Show \d+ results|^Show results|^Counting/ })];
  for (const b of buttons) {
    expect(style(b, 'color')).toContain('ink');
    expect(style(b, 'border-color')).toContain('muted');
    expect(style(b, 'height')).toContain('sizes-8');
  }
});

it('keeps the disabled Clear filters button as solid as the others', async () => {
  renderApp(fakeApi());
  await search('a');
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  const clear = (await screen.findByRole('button', { name: 'Clear filters' })) as HTMLButtonElement;
  expect(clear.disabled).toBe(true);
  expect(css()).toMatch(new RegExp(`\\.${[...clear.classList].pop()}[^{]*\\{[^}]*opacity:1`));
});

it('shows Portfolio eligible only above Shares issued, and top-level flag labels in ink', async () => {
  renderApp(fakeApi());
  await search('a');
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  const portfolio = await screen.findByRole('checkbox', { name: /Portfolio eligible only/ });
  const units = await screen.findByText(/Shares issued \(equities only\)/, { selector: "legend" });
  expect(portfolio.compareDocumentPosition(units) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const label = (name: RegExp) => screen.getByText(name, { selector: 'span' });
  expect(style(label(/Flagship funds/), 'color')).toMatch(/colors-fg\)/);
  expect(style(label(/Portfolio eligible only/), 'color')).toMatch(/colors-fg\)/);
  expect(style(label(/^ETFs/), 'color')).toContain('fg-muted');
});

it('indents the suggestion options under their group title', async () => {
  renderApp(fakeApi());
  const input = screen.getByLabelText('Search shares and ETFs');
  act(() => input.focus());
  fireEvent.change(input, { target: { value: 'glo' } });
  const option = (await screen.findAllByRole('option', { hidden: true }, { timeout: 3000 }))[0];
  expect(all(option, 'padding-inline-start').join()).toContain('indent');
  expect(all(screen.getByText('Matching shares and ETFs'), 'padding-inline-start')).toEqual([]);
});
