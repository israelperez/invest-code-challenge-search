// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, fakeApi, renderApp, type FakeApi } from '../../tests/component/app-harness';
import { config } from '../config';

// Fake timers only for setTimeout, so promises and Testing Library polling keep working.
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const input = () => screen.getByLabelText('Search shares and ETFs') as HTMLInputElement;
// The combobox applies a key a tick later.
const key = async (name: string) => {
  fireEvent.keyDown(input(), { key: name });
  await tick(0);
};
// Hidden roles included: while the filters drawer is open the page behind it is aria-hidden.
const options = () => {
  const listbox = screen.queryByRole('listbox', { hidden: true });
  return listbox ? within(listbox).queryAllByRole('option', { hidden: true }).map((o) => o.textContent) : [];
};
const highlighted = () => document.getElementById(input().getAttribute('aria-activedescendant') ?? '')?.textContent;
const expanded = () => input().getAttribute('aria-expanded');
const status = () => screen.getByTestId('suggestion-status').textContent;

// Types, waits out the debounce and lets the lookups answer.
async function typeAndSettle(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await tick(config.suggestionDebounceMs + 10);
}
async function open(text = 'glo') {
  act(() => input().focus());
  await typeAndSettle(text);
  // The combobox starts listening for Escape and outside clicks on the next animation frame.
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}
const searchRequests = (api: FakeApi) => api.searchIndex.mock.calls.map(([body]) => body);
const results = () => searchRequests(api).filter((body) => body.include?.includes('documents'));

let api: FakeApi;
beforeEach(() => {
  fake.indexedAt = 1;
  api = fakeApi();
  renderApp(api);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Suggestions requests', () => {
  it('asks for nothing under 3 characters', async () => {
    await open('gl');

    expect(api.suggestInstruments).not.toHaveBeenCalled();
    expect(api.facetIssuer).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('sends one request 200ms after typing stops', async () => {
    act(() => input().focus());
    fireEvent.change(input(), { target: { value: 'glo' } });
    await tick(199);
    expect(api.suggestInstruments).not.toHaveBeenCalled();

    fireEvent.change(input(), { target: { value: 'glob' } });
    await tick(199);
    expect(api.suggestInstruments).not.toHaveBeenCalled();
    await tick(1);

    expect(api.suggestInstruments).toHaveBeenCalledTimes(1);
    expect(api.suggestInstruments.mock.calls[0][0]).toEqual({ search_text: 'glob', size: 5 });
  });

  it('aborts the in-flight request when typing resumes', async () => {
    api.suggestInstruments.mockImplementation(() => new Promise(() => {}));
    await open('glo');
    const signal = api.suggestInstruments.mock.calls[0][1]!;
    expect(signal.aborted).toBe(false);

    fireEvent.change(input(), { target: { value: 'glob' } });

    expect(signal.aborted).toBe(true);
  });

  it('does not show an answer that arrives after typing resumed', async () => {
    let answer!: (value: Awaited<ReturnType<FakeApi['suggestInstruments']>>) => void;
    api.suggestInstruments.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await open('glo');
    fireEvent.change(input(), { target: { value: 'gl' } });
    await act(async () => answer({ results: [{ symbol: 'OLD', symbol_openfigi: 'OLD:AU', display_name: 'Old', logo: null }], count: 1, indexed_at: 1 }));

    expect(screen.queryByText('OLD')).toBeNull();
  });
});

describe('Suggestions list', () => {
  it('shows the two labelled groups', async () => {
    await open();

    expect(expanded()).toBe('true');
    const searches = screen.getByRole('group', { name: 'Suggested searches' });
    const instruments = screen.getByRole('group', { name: 'Matching shares and ETFs' });
    expect(within(searches).getAllByRole('option').map((o) => o.textContent)).toEqual(['Global X', 'Global Funds', 'X Global']);
    expect(within(instruments).getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('GLOB'),
      expect.stringContaining('ARMR'),
    ]);
    expect(within(instruments).getAllByRole('option')[0].textContent).toContain('Global Share Active ETF');
  });

  it('moves the highlight with Arrow Up/Down across both groups, and Home/End', async () => {
    await open();
    expect(highlighted()).toBeUndefined();

    await key('ArrowDown');
    expect(highlighted()).toBe('Global X');
    await key('ArrowDown');
    await key('ArrowDown');
    await key('ArrowDown');
    expect(highlighted()).toContain('GLOB');
    await key('ArrowUp');
    expect(highlighted()).toBe('X Global');
    await key('End');
    expect(highlighted()).toContain('ARMR');
    await key('Home');
    expect(highlighted()).toBe('Global X');
  });

  it('closes on Escape, then clears the input on a second Escape', async () => {
    await open();

    await key('Escape');
    expect(expanded()).toBe('false');
    expect(input().value).toBe('glo');

    await key('Escape');
    expect(input().value).toBe('');
  });

  it('closes when focus moves to the Search button, as Tab does, and leaves it there', async () => {
    await open();
    const button = screen.getByRole('button', { name: 'Search' });
    act(() => button.focus());
    await tick(0);
    // Zag refocuses the input on the next animation frame unless the close was a focus-outside one.
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await tick(0);

    expect(expanded()).toBe('false');
    expect(input().value).toBe('glo');
    expect(document.activeElement).toBe(button);
  });

  it('announces loading, then the number of suggestions, in a polite live region', async () => {
    api.suggestInstruments.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ results: [], count: 0, indexed_at: 1 }), 50)),
    );
    act(() => input().focus());
    fireEvent.change(input(), { target: { value: 'glo' } });
    await tick(config.suggestionDebounceMs);

    expect(screen.getByTestId('suggestion-status').getAttribute('aria-live')).toBe('polite');
    expect(status()).toBe('Loading suggestions');
    await tick(60);
    expect(status()).toBe('3 suggestions');
  });

  it('announces "No suggestions" when nothing matches', async () => {
    await open('zzz');

    expect(status()).toBe('No suggestions');
    expect(options()).toEqual([]);
  });

  it('has no accessibility violations with the list open', async () => {
    await open();
    await key('ArrowDown');

    // axe's page-level landmark rule does not apply to a component under test.
    vi.useRealTimers();
    expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });
});

// Chakra hides an open list with no items unless it holds a Combobox.Empty, and jsdom does not apply that CSS,
// so these pin the cause: the empty states must sit inside [data-part="empty"].
describe('Empty states stay visible', () => {
  const empty = () => screen.getByRole('listbox', { hidden: true }).querySelector('[data-part="empty"]');

  it('shows skeleton rows while the first lookup is pending', async () => {
    api.suggestInstruments.mockImplementation(() => new Promise(() => {}));
    await open('glo');

    expect(expanded()).toBe('true');
    expect(empty()!.querySelectorAll('[data-testid="suggestion-skeleton-row"]')).toHaveLength(config.suggestionSkeletonRows);
    expect(status()).toBe('Loading suggestions');
  });

  it('shows "No suggestions" inside the empty element', async () => {
    await open('zzz');

    expect(empty()!.textContent).toBe('No suggestions');
  });

  it('shows "Suggestions unavailable" inside the empty element', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.facetIssuer.mockRejectedValue(new Error('down'));
    api.suggestInstruments.mockRejectedValue(new Error('down'));
    await open('glo');

    expect(empty()!.textContent).toBe('Suggestions unavailable');
    error.mockRestore();
  });
});

describe('Stale and failed lookups', () => {
  const answer = (symbol: string) => ({ results: [{ symbol, symbol_openfigi: `${symbol}:AU`, display_name: symbol, logo: null }], count: 1, indexed_at: 1 });

  it('drops the previous answer for a skeleton until the one for the current text lands', async () => {
    await open('glo');
    let later!: (value: ReturnType<typeof answer>) => void;
    api.suggestInstruments.mockImplementationOnce(() => new Promise((resolve) => (later = resolve)));

    fireEvent.change(input(), { target: { value: 'glob' } });
    expect(options()).toEqual([]);
    await tick(config.suggestionDebounceMs + 10);
    expect(options()).toEqual([]);
    expect(screen.getAllByTestId('suggestion-skeleton-row')).toHaveLength(config.suggestionSkeletonRows);
    expect(expanded()).toBe('true');

    // Enter while loading submits the typed text.
    await key('Enter');
    fireEvent.submit(input().closest('form')!);
    await tick(10);
    expect(searchRequests(api).at(-1)).toMatchObject({ search_text: 'glob' });

    await act(async () => later(answer('GLOBE')));
    expect(screen.getByRole('option', { name: /GLOBE/, hidden: true })).toBeTruthy();
  });

  it('shows and announces "Suggestions unavailable" when both lookups fail', async () => {
    api.facetIssuer.mockRejectedValue(new Error('issuers down'));
    api.suggestInstruments.mockRejectedValue(new Error('search down'));
    await open('glo');

    expect(status()).toBe('Suggestions unavailable');
  });

  it('does not log an aborted lookup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.suggestInstruments.mockImplementation((_body, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    await open('glo');
    fireEvent.change(input(), { target: { value: 'gl' } });
    await tick(10);

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('Picking a suggestion is a search', () => {
  it('shows the skeleton, not the pre-pick items, and looks up the picked text', async () => {
    await open('glo');
    await key('ArrowDown');
    await key('Enter');
    await tick(10);
    expect(expanded()).toBe('false');
    const before = searchRequests(api).length;

    await key('ArrowDown');
    expect(expanded()).toBe('true');
    expect(options()).toEqual([]);
    expect(screen.getAllByTestId('suggestion-skeleton-row')).toHaveLength(config.suggestionSkeletonRows);
    await key('Enter');
    await tick(10);
    expect(searchRequests(api)).toHaveLength(before);

    await tick(config.suggestionDebounceMs);
    expect(api.suggestInstruments.mock.calls.at(-1)![0]).toEqual({ search_text: 'Global X', size: 5 });
  });

  it('Enter on a term fills its label and searches for it', async () => {
    await open();
    await key('ArrowDown');
    await key('Enter');
    await tick(10);

    expect(input().value).toBe('Global X');
    expect(searchRequests(api).at(-1)).toMatchObject({ search_text: 'Global X' });
    expect(expanded()).toBe('false');
  });

  it('clicking an instrument searches for its ticker and fills it', async () => {
    await open();
    fireEvent.click(screen.getByRole('option', { name: /ARMR/ }));
    await tick(10);

    expect(input().value).toBe('ARMR');
    expect(searchRequests(api).at(-1)).toMatchObject({ search_text: 'ARMR' });
  });

  it('Enter with nothing highlighted submits the typed text', async () => {
    await open('a');
    act(() => input().focus());
    await typeAndSettle('glo');
    fireEvent.submit(input().closest('form')!);
    await tick(10);

    expect(searchRequests(api).at(-1)).toMatchObject({ search_text: 'glo' });
    expect(expanded()).toBe('false');
  });

  // The mobile drawer is modal, so the input cannot be reached while ticks are pending there. Beside the results
  // (tablet and up) a tick is applied at once, and a pick afterwards must clear it. Same App.search path.
  it('clears the applied filters, including a tick just made', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: true })) as typeof window.matchMedia;
    try {
      cleanup();
      renderApp(api);
      fireEvent.change(input(), { target: { value: 'a' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      await tick(10);
      fireEvent.click(screen.getByRole('checkbox', { name: /ETFs/ }));
      await tick(20);
      expect(results().at(-1)).toMatchObject({ kind: ['etf'] });

      await open('glo');
      await key('ArrowDown');
      fireEvent.click(screen.getByRole('checkbox', { name: /Shares \(equities\)/ }));
      await tick(10);
      await key('Enter');
      await tick(20);

      expect(results().at(-1)).toMatchObject({ search_text: 'Global X' });
      expect(results().at(-1)).not.toHaveProperty('kind');
      expect((screen.getByRole('checkbox', { name: /Shares \(equities\)/ }) as HTMLInputElement).checked).toBe(false);
      expect((screen.getByRole('checkbox', { name: /ETFs/ }) as HTMLInputElement).checked).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});
