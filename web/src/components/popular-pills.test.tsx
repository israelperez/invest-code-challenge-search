// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { deferred, fake, fakeApi, renderApp, rows, search, type FakeApi } from '../../tests/component/app-harness';

const input = () => screen.getByLabelText('Search shares and ETFs') as HTMLInputElement;
const resultRequests = (api: FakeApi) => api.searchIndex.mock.calls.filter(([body]) => body.include?.includes('documents'));

const realMatchMedia = window.matchMedia;
// Chakra asks matchMedia for min-width queries; this answers them for a viewport of the given width.
function viewport(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*([\d.]+)(px|rem|em)/.exec(query);
    const px = min ? Number(min[1]) * (min[2] === 'px' ? 1 : 16) : 0;
    return { ...realMatchMedia(query), matches: width >= px };
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  fake.indexedAt = 1;
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
  cleanup();
  vi.restoreAllMocks();
});

describe('Popular search pills', () => {
  it('render as buttons under the input', async () => {
    renderApp(fakeApi());
    const pill = await screen.findByRole('button', { name: 'A200' });
    await screen.findByRole('button', { name: 'Vanguard' });

    expect(input().compareDocumentPosition(pill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('click fills the input and runs a logged search', async () => {
    const api = fakeApi();
    renderApp(api);

    fireEvent.click(await screen.findByRole('button', { name: 'Vanguard' }));

    expect(input().value).toBe('Vanguard');
    expect(api.logSearch.mock.calls.map(([term]) => term)).toEqual(['Vanguard']);
    await waitFor(() => expect(resultRequests(api).at(-1)![0]).toMatchObject({ search_text: 'Vanguard' }));
  });

  it('give way to the results after a pill click', async () => {
    renderApp(fakeApi());
    fireEvent.click(await screen.findByRole('button', { name: 'A200' }));
    await screen.findByRole('heading', { level: 2, name: /results/i });

    expect(screen.queryByRole('region', { name: /popular searches/i })).toBeNull();
    expect(rows().length).toBeGreaterThan(0);
  });

  it('give way to the results after a typed search', async () => {
    renderApp(fakeApi());
    await screen.findByRole('region', { name: /popular searches/i });
    await search('b');

    expect(screen.queryByRole('region', { name: /popular searches/i })).toBeNull();
    expect(rows().length).toBeGreaterThan(0);
  });

  it('show a skeleton, not pills, while loading, then the pills', async () => {
    const api = fakeApi();
    const pending = deferred<Awaited<ReturnType<typeof api.popular>>>();
    api.popular.mockReturnValue(pending.promise);
    renderApp(api);

    const section = screen.getByRole('region', { name: 'Popular searches' });
    expect(section.getAttribute('aria-busy')).toBe('true');
    expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe('Popular searches');
    expect(screen.getByText('Loading popular searches')).toBeTruthy();
    expect(screen.getAllByTestId('popular-skeleton-pill')).toHaveLength(config.popularShown.mobile);
    expect(screen.queryByRole('button', { name: 'A200' })).toBeNull();
    // axe's page-level landmark rule does not apply to a component under test.
    expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);

    pending.resolve({ terms: [{ label: 'A200', key: 'a200', clients: 9 }], includes_seed_data: true });
    await screen.findByRole('button', { name: 'A200' });
    expect(screen.queryByText('Loading popular searches')).toBeNull();
    expect(screen.queryAllByTestId('popular-skeleton-pill')).toHaveLength(0);
  });

  it.each([
    ['mobile', 390, 6],
    ['tablet', 900, 8],
    ['desktop', 1300, 13],
  ])('show %s pills (%i wide) from one request for the largest count', async (_name, width, shown) => {
    viewport(width);
    const api = fakeApi();
    const pending = deferred<Awaited<ReturnType<typeof api.popular>>>();
    api.popular.mockReturnValue(pending.promise);
    renderApp(api);
    expect(screen.getAllByTestId('popular-skeleton-pill')).toHaveLength(shown);

    pending.resolve({
      terms: Array.from({ length: 15 }, (_, i) => ({ label: `T${i}`, key: `t${i}`, clients: 9 })),
      includes_seed_data: true,
    });
    await screen.findByRole('button', { name: 'T0' });

    expect(within(screen.getByRole('region', { name: 'Popular searches' })).getAllByRole('button')).toHaveLength(shown);
    expect(api.popular).toHaveBeenCalledWith(13);
  });

  describe('in one-line mode', () => {
    const settings = config as { popularSearchOneLine: boolean };
    const original = settings.popularSearchOneLine;
    const realTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    const realObserver = globalThis.ResizeObserver;
    // Pills with an index of wrapFrom or more sit on a second row.
    let wrapFrom = 4;
    let observed: Element[] = [];
    let fire = () => {};
    beforeEach(() => {
      wrapFrom = 4;
      observed = [];
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
        configurable: true,
        get(this: HTMLElement) {
          return [...(this.parentElement?.children ?? [])].indexOf(this) >= wrapFrom ? 44 : 0;
        },
      });
      // Captures what the component observes, so a test can fire a resize by hand.
      globalThis.ResizeObserver = class {
        constructor(callback: () => void) {
          fire = () => act(callback);
        }
        observe(element: Element) {
          observed.push(element);
        }
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    });
    afterEach(() => {
      globalThis.ResizeObserver = realObserver;
      settings.popularSearchOneLine = original;
      if (realTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', realTop);
    });

    async function pills() {
      viewport(1300);
      const api = fakeApi();
      api.popular.mockResolvedValue({
        terms: Array.from({ length: 8 }, (_, i) => ({ label: `T${i}`, key: `t${i}`, clients: 9 })),
        includes_seed_data: true,
      });
      renderApp(api);
      // The closed search popup also holds the top popular terms, so the pills are found inside their own section.
      const pills = within(await screen.findByRole('region', { name: 'Popular searches' }));
      await pills.findByText('T0');
      return Array.from({ length: 8 }, (_, i) => pills.getByText(`T${i}`).closest('button')!);
    }

    it('makes the pills that wrap inert and hidden from assistive tech, and no others', async () => {
      settings.popularSearchOneLine = true;
      const buttons = await pills();

      expect(buttons.map((b) => b.hasAttribute('inert'))).toEqual([false, false, false, false, true, true, true, true]);
      expect(buttons.map((b) => b.getAttribute('aria-hidden'))).toEqual([null, null, null, null, 'true', 'true', 'true', 'true']);
      // axe's page-level landmark rule does not apply to a component under test.
      expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
    });

    it('re-measures when a pill changes width without the row resizing', async () => {
      settings.popularSearchOneLine = true;
      const buttons = await pills();
      expect(observed).toEqual(expect.arrayContaining(buttons));

      wrapFrom = 3;
      fire();

      expect(buttons.map((b) => b.hasAttribute('inert') && b.getAttribute('aria-hidden') === 'true')).toEqual([false, false, false, true, true, true, true, true]);
    });

    it('moves focus to the last visible pill when the focused one gets hidden', async () => {
      settings.popularSearchOneLine = true;
      const buttons = await pills();
      buttons[3].focus();

      wrapFrom = 3;
      fire();

      expect(document.activeElement).toBe(buttons[2]);
    });

    it('hides nothing when off', async () => {
      settings.popularSearchOneLine = false;
      const buttons = await pills();

      expect(buttons.some((b) => b.hasAttribute('inert') || b.hasAttribute('aria-hidden'))).toBe(false);
    });
  });

  it('are fetched once', async () => {
    const api = fakeApi();
    renderApp(api);
    await screen.findByRole('button', { name: 'A200' });
    await search('b');

    expect(api.popular).toHaveBeenCalledTimes(1);
    expect(api.popular).toHaveBeenCalledWith(13);
  });

  it('sit in a "Popular searches" section with exactly that heading', async () => {
    renderApp(fakeApi());
    const section = await screen.findByRole('region', { name: 'Popular searches' });

    expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe('Popular searches');
    expect(within(section).getByRole('button', { name: 'A200' })).toBeTruthy();
  });

  it.each([
    ['returns no popular searches', (api: ReturnType<typeof fakeApi>) => api.popular.mockResolvedValue({ terms: [], includes_seed_data: true })],
    ['fails', (api: ReturnType<typeof fakeApi>) => api.popular.mockRejectedValue(new Error('down'))],
  ])('stay as skeletons, with no pills or error text, when the fetch %s', async (_name, setup) => {
    const api = fakeApi();
    setup(api);
    renderApp(api);
    await waitFor(() => expect(api.popular).toHaveBeenCalled());

    expect((await screen.findAllByTestId('popular-skeleton-pill')).length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Popular searches' }).getAttribute('aria-busy')).toBe('true');
    expect(within(screen.getByRole('region', { name: 'Popular searches' })).queryAllByRole('button')).toEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pass axe', async () => {
    renderApp(fakeApi());
    await screen.findByRole('button', { name: 'A200' });

    // axe's page-level landmark rule does not apply to a component under test.
    expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });
});
