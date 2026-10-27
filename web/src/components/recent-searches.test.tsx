// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import type { Analytics } from '../analytics/analytics';
import { deferred, fake, fakeApi, freshRecentStore, renderApp, search, type FakeApi } from '../../tests/component/app-harness';
import { config } from '../config';
import type { RecentSearchStore } from '../search/recent-search-store';

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const input = () => screen.getByLabelText('Search shares and ETFs') as HTMLInputElement;
const options = () => {
  const listbox = screen.queryByRole('listbox', { hidden: true });
  return listbox ? within(listbox).queryAllByRole('option', { hidden: true }).map((o) => o.textContent) : [];
};
const listbox = () => screen.getByRole('listbox', { hidden: true });
const expanded = () => input().getAttribute('aria-expanded');
const documentRequests = (api: FakeApi) => api.searchIndex.mock.calls.map(([b]) => b).filter((b) => b.include?.includes('documents'));

let api: FakeApi;
let recent: RecentSearchStore;
let track: MockedFunction<Analytics['track']>;
const popularResponse = (labels: string[]) => ({ terms: labels.map((label, i) => ({ label, key: label.toLowerCase(), clients: 20 - i })), includes_seed_data: true as const });
// The popular searches are empty unless a test names them, so the recent-only tests see only recent searches.
function setup(terms: string[] = [], options: { flagOff?: boolean; popular?: string[] } = {}) {
  fake.indexedAt = 1;
  api = fakeApi();
  api.popular.mockResolvedValue(popularResponse(options.popular ?? []));
  recent = freshRecentStore();
  [...terms].reverse().forEach(recent.add);
  track = vi.fn<Analytics['track']>();
  renderApp(api, { recent: options.flagOff ? null : recent, analytics: { track } });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}
// The combobox starts listening for Escape and outside clicks on the next animation frame.
async function focus() {
  act(() => input().focus());
  await tick(0);
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}
async function type(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await tick(config.suggestionDebounceMs + 10);
}
// Real timers for the search itself: results arrive over promises and Testing Library polling.
async function submit(term: string) {
  vi.useRealTimers();
  await search(term);
  await waitFor(() => expect(documentRequests(api).length).toBeGreaterThan(0));
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Recent searches popup', () => {
  it('shows the recent searches when the empty input is focused', async () => {
    setup(['A200', 'Vanguard']);
    await focus();

    expect(expanded()).toBe('true');
    expect(screen.getByRole('group', { name: 'Recent searches', hidden: true })).toBeTruthy();
    expect(options()).toEqual(['A200', 'Vanguard']);
  });

  it('closes when focus moves to the Search button, as Tab does, and leaves it there', async () => {
    setup(['A200']);
    await focus();
    expect(expanded()).toBe('true');

    const button = screen.getByRole('button', { name: 'Search' });
    act(() => button.focus());
    await tick(0);
    // Zag refocuses the input on the next animation frame unless the close was a focus-outside one.
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await tick(0);

    expect(expanded()).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('shows a hint when there are none', async () => {
    setup();
    await focus();

    expect(expanded()).toBe('true');
    expect(within(listbox()).getByText('No recent searches yet')).toBeTruthy();
    expect(options()).toEqual([]);
  });

  it('shows only the recent searches starting with 1-2 typed characters', async () => {
    setup(['A200', 'Vanguard', 'ndq', 'Alpha']);
    await focus();

    await type('a');
    expect(options()).toEqual(['A200', 'Alpha']);
    await type('va');
    expect(options()).toEqual(['Vanguard']);
    expect(api.suggestInstruments).not.toHaveBeenCalled();
  });

  it('stays closed at 1-2 characters when none match', async () => {
    setup(['A200']);
    await focus();

    await type('zq');

    expect(expanded()).toBe('false');
  });

  it('hands over to suggestions from 3 characters, never mixing the two', async () => {
    setup(['Vanguard', 'Vanilla']);
    await focus();
    await type('va');
    expect(options()).toEqual(['Vanguard', 'Vanilla']);

    await type('van');

    expect(api.suggestInstruments).toHaveBeenCalledTimes(1);
    expect(options()).toContain('GLOBGlobal Share Active ETF');
    expect(options()).not.toContain('Vanguard');
    expect(within(listbox()).queryByText('Recent searches')).toBeNull();
  });

  it('runs the search when a recent search is picked', async () => {
    setup(['b']);
    await focus();
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('option', { name: /^b/ }));

    await screen.findByRole('heading', { level: 2 });
    expect(input().value).toBe('b');
    expect(documentRequests(api)[0].search_text).toBe('b');
  });

  it('offers nothing when the feature is off', async () => {
    setup(['A200'], { flagOff: true });
    await focus();

    expect(expanded()).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('has no accessibility violations with the list open', async () => {
    setup(['A200', 'Vanguard']);
    await focus();
    vi.useRealTimers();

    // The header's unlabelled gear button is outside this feature, so only the search form is checked.
    expect((await axe(document.querySelector('form')!, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });
});

describe('Saving a recent search', () => {
  it('saves a search once its results land', async () => {
    setup();
    await submit('b');

    await waitFor(() => expect(recent.list()).toEqual(['b']));
  });

  it('saves a repeat search answered from the cache', async () => {
    setup();
    await submit('b');
    await submit('c');
    await waitFor(() => expect(recent.list()).toEqual(['c', 'b']));

    await search('b');

    await waitFor(() => expect(recent.list()).toEqual(['b', 'c']));
  });

  it('does not save a search with no results', async () => {
    setup();
    await submit('none');
    await settle();

    expect(recent.list()).toEqual([]);
  });

  it('does not save a failed search', async () => {
    setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.searchIndex.mockRejectedValue(new Error('down'));
    vi.useRealTimers();
    fireEvent.change(input(), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(api.searchIndex).toHaveBeenCalled());
    await settle();

    expect(recent.list()).toEqual([]);
    consoleError.mockRestore();
  });

  it('does not save a search superseded before its results land', async () => {
    setup();
    const real = api.searchIndex.getMockImplementation()!;
    const slow = deferred<void>();
    api.searchIndex.mockImplementation(async (body, signal) => {
      if (body.search_text === 'b') await slow.promise;
      return real(body, signal);
    });
    vi.useRealTimers();
    fireEvent.change(input(), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await submit('c');
    await waitFor(() => expect(recent.list()).toEqual(['c']));

    slow.resolve();
    await settle();

    expect(recent.list()).toEqual(['c']);
  });

  it('does not save a refinement as a new search', async () => {
    setup();
    const add = vi.spyOn(recent, 'add');
    await submit('b');
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.desc' } });
    await waitFor(() => expect(documentRequests(api).length).toBeGreaterThan(1));
    await settle();

    expect(add).toHaveBeenCalledTimes(1);
  });

  it('saves a popular pill click', async () => {
    setup();
    vi.useRealTimers();

    fireEvent.click(await screen.findByRole('button', { name: 'A200' }));

    await waitFor(() => expect(recent.list()).toEqual(['A200']));
  });
});

describe('Popular searches in the empty-search popup', () => {
  const popular = ['A200', 'NDQ', 'QAU', 'DHHF', 'HQLT', 'BGBL', 'IOZ'];
  const groups = () => within(listbox()).getAllByRole('group', { hidden: true }).map((g) => g.getAttribute('aria-label') ?? within(g).getByText(/searches$/).textContent);

  it('lists Recent searches, then the top 5 Popular searches, in one popup', async () => {
    setup(['Vanguard'], { popular });
    await focus();

    expect(groups()).toEqual(['Recent searches', 'Popular searches']);
    expect(options()).toEqual(['Vanguard', 'A200', 'NDQ', 'QAU', 'DHHF', 'HQLT']);
  });

  it('shows the popular group alone when nothing was searched yet', async () => {
    setup([], { popular });
    await focus();

    expect(groups()).toEqual(['Popular searches']);
    expect(within(listbox()).queryByText('No recent searches yet')).toBeNull();
  });

  it('leaves the popular group out for 1-2 typed characters and for suggestions', async () => {
    setup(['A200'], { popular });
    await focus();

    await type('a');
    expect(groups()).toEqual(['Recent searches']);
    await type('van');
    expect(within(listbox()).queryByText('Popular searches')).toBeNull();
  });

  it('runs the search and reports the popular trigger when a popular item is picked', async () => {
    setup([], { popular });
    await focus();
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('option', { name: 'NDQ' }));

    await screen.findByRole('heading', { level: 2 });
    expect(input().value).toBe('NDQ');
    expect(documentRequests(api)[0].search_text).toBe('NDQ');
    expect(api.logSearch).toHaveBeenCalledWith('NDQ', expect.any(String), expect.any(String));
    expect(track).toHaveBeenCalledWith('search_submitted', { term: 'NDQ', source: 'popular' });
  });

  it('keeps the recent group when the popular fetch fails, with no error text', async () => {
    setup(['Vanguard']);
    api.popular.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await focus();

    expect(groups()).toEqual(['Recent searches']);
    expect(options()).toEqual(['Vanguard']);
    expect(within(listbox()).queryByText(/unavailable|error|failed/i)).toBeNull();
  });

  it('keeps the recent hint when the popular result is empty', async () => {
    setup();
    await focus();

    expect(within(listbox()).getByText('No recent searches yet')).toBeTruthy();
  });

  it('announces the items from both groups', async () => {
    setup(['Vanguard'], { popular });
    await focus();

    expect(screen.getByTestId('suggestion-status').textContent).toBe('6 searches');
  });

  it('moves with the arrow keys across both groups', async () => {
    setup(['Vanguard'], { popular });
    await focus();

    for (let i = 0; i < 2; i++) {
      fireEvent.keyDown(input(), { key: 'ArrowDown' });
      await tick(0);
    }

    const active = input().getAttribute('aria-activedescendant');
    expect(document.getElementById(active!)?.textContent).toBe('A200');
  });

  it('passes axe with both groups showing', async () => {
    setup(['Vanguard'], { popular });
    await focus();
    vi.useRealTimers();

    expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });
});
