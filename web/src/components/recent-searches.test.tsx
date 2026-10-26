// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
function setup(terms: string[] = [], options: { flagOff?: boolean } = {}) {
  fake.indexedAt = 1;
  api = fakeApi();
  recent = freshRecentStore();
  [...terms].reverse().forEach(recent.add);
  renderApp(api, { recent: options.flagOff ? null : recent });
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
