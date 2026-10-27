// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, fakeApi, renderApp, search, type FakeApi } from '../../tests/component/app-harness';

const resultRequests = (api: FakeApi) => api.searchIndex.mock.calls.filter(([body]) => body.include?.includes('documents'));
const lastResults = (api: FakeApi) => resultRequests(api).at(-1)![0];
const chipRow = () => screen.queryByRole('list', { name: 'Applied filters' });
const remove = (label: string) => screen.getByRole('button', { name: `Remove ${label}` });
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// Ticks ETFs and Shares, then applies them the way the layout does: the drawer button, or the rail's debounce.
async function setup(live: boolean) {
  const mobileMatchMedia = window.matchMedia;
  if (live) window.matchMedia = ((query: string) => ({ ...mobileMatchMedia(query), matches: true })) as typeof window.matchMedia;
  const api = fakeApi();
  renderApp(api);
  await search('a');
  expect(chipRow()).toBeNull();
  if (!live) fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  for (const name of [/ETFs/, /Shares \(equities\)/]) {
    const box = await screen.findByRole('checkbox', { name });
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(box);
    await waitFor(() => expect((box as HTMLInputElement).checked).toBe(true));
  }
  if (!live) fireEvent.click(await screen.findByRole('button', { name: /^Show \d/ }));
  await waitFor(() => expect(lastResults(api)).toMatchObject({ kind: ['equity', 'etf'] }));
  if (live) await screen.findByRole('list', { name: 'Applied filters' });
  window.matchMedia = mobileMatchMedia;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  return api;
}

beforeEach(() => {
  fake.indexedAt = 1;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// Below the tablet width the Filters drawer is the only place to change filters, so the chip row stays out of the results.
it('shows no chip row in the drawer layout, even with filters applied', async () => {
  await setup(false);
  expect(chipRow()).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove ETFs' })).toBeNull();
});

describe.each([['beside the results', true]])('applied filter chips %s', (_name, live) => {
  it('shows one chip per value, and removing one sends the narrowed request at once', async () => {
    const api = await setup(live);
    expect(within(chipRow()!).getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(remove('ETFs'));
    // Less than the rail's debounce, so only an immediate apply can have sent it.
    await tick(10);

    expect(lastResults(api)).toMatchObject({ kind: ['equity'], search_text: 'a' });
    expect(screen.queryByRole('button', { name: 'Remove ETFs' })).toBeNull();
    if (live) expect((screen.getByRole('checkbox', { name: /ETFs/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('moves focus to the next chip, then to the results heading once none are left', async () => {
    await setup(live);

    fireEvent.click(remove('ETFs'));
    await tick(10);
    expect(document.activeElement).toBe(remove('Shares (equities)'));

    fireEvent.click(remove('Shares (equities)'));
    await tick(10);
    expect(chipRow()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
  });

  it('moves focus to the previous chip when the last one is removed', async () => {
    await setup(live);
    fireEvent.click(remove('Shares (equities)'));
    await tick(10);
    expect(document.activeElement).toBe(remove('ETFs'));
  });

  it('Clear filters drops the filters only, keeping the search text and sort', async () => {
    const api = await setup(live);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.asc' } });
    await tick(10);

    fireEvent.click(within(chipRow()!).getByRole('button', { name: 'Clear filters' }));
    await tick(10);

    expect(lastResults(api)).toEqual(expect.objectContaining({ search_text: 'a', order_by: 'symbol.asc' }));
    expect(lastResults(api)).not.toHaveProperty('kind');
    expect(chipRow()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
  });
});

// The chips are the tertiary button: the result-tag colours on a 32px pill (see theme.test.ts for the recipe).
it('renders each chip as a tertiary button that still names what it removes (removal itself is covered above)', async () => {
  await setup(true);
  const chip = screen.getByRole('button', { name: 'Remove ETFs' });
  const css = Array.from(document.querySelectorAll('style'), (e) => e.textContent).join('\n');
  const rules = [...chip.classList].flatMap((c) => [...css.matchAll(new RegExp(`\\.${c}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1])).join(';');
  expect(rules).toContain('sizes-8');
  expect(rules).toMatch(/tag-bg/);
  expect(rules).toMatch(/tag-border/);
  expect(chip.textContent).toContain('ETFs');
});
