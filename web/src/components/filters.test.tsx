// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FacetEntry, SearchIndexRequest } from '../../src/api/types';
import { deferred, fake, fakeApi, fakeFacets, renderApp, rows, search, skeletonRows, type FakeApi } from '../../tests/component/app-harness';

const isCounts = (body: SearchIndexRequest) => !body.include?.includes('documents');
const countRequests = (api: FakeApi) => api.searchIndex.mock.calls.filter(([body]) => isCounts(body));
const resultRequests = (api: FakeApi) => api.searchIndex.mock.calls.filter(([body]) => !isCounts(body));
const box = (name: RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const applyButton = () => screen.queryByRole('button', { name: /^(Show (\d|results)|No matching)/ }) as HTMLButtonElement | null;
// Fake timers only for setTimeout, so promises and Testing Library polling keep working.
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
// The checkbox reports its change a microtask after the click, so let it land before the clock moves.
const click = async (element: HTMLElement) => {
  fireEvent.click(element);
  await tick(0);
};
// Below the tablet breakpoint the filters live in a drawer; beside the results there is no trigger and nothing to open.
const filtersTrigger = () => screen.queryByRole('button', { name: /^Filters/ }) as HTMLButtonElement | null;
const openDrawer = async () => {
  if (filtersTrigger()?.getAttribute('aria-expanded') === 'false') await click(filtersTrigger()!);
};
const tickOption = async (name: RegExp) => {
  await openDrawer();
  await click(box(name));
  await tick(0);
  await tick(10);
};

// Overrides the count and facets of counts-only requests; results requests are untouched.
function replyCounts(api: FakeApi, make: (body: SearchIndexRequest) => { count?: number; facets?: Record<string, FacetEntry[]> }) {
  const base = api.searchIndex.getMockImplementation()!;
  api.searchIndex.mockImplementation(async (body, signal) => {
    const response = await base(body, signal);
    if (!isCounts(body)) return response;
    const { count = response.count, facets } = make(body);
    return { ...response, count, facets: { ...response.facets, ...facets } };
  });
}

async function setup(make?: Parameters<typeof replyCounts>[1]) {
  const api = fakeApi();
  if (make) replyCounts(api, make);
  renderApp(api);
  await search('a');
  if (filtersTrigger()) fireEvent.click(filtersTrigger()!);
  await waitFor(() => expect(box(/ETFs/).disabled).toBe(false));
  await waitFor(() => expect(screen.getAllByText('834').length).toBeGreaterThan(0));
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

// Answers requests whose body matches `hang` only when aborted (rejecting with the abort reason), so a later tick can be seen to cancel them.
function hangUntilAborted(api: FakeApi, hang: (body: SearchIndexRequest) => boolean) {
  const base = api.searchIndex.getMockImplementation()!;
  api.searchIndex.mockImplementation((body, signal) =>
    hang(body) ? new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason))) : base(body, signal),
  );
}
const onlyEtf = (body: SearchIndexRequest) => body.kind?.length === 1 && body.kind[0] === 'etf';

describe('Filters', () => {
  it('cancels the earlier counts request when a second tick follows, and shows the latest counts', async () => {
    const api = await setup();
    const before = countRequests(api).length;
    hangUntilAborted(api, (body) => isCounts(body) && onlyEtf(body));

    await click(box(/ETFs/));
    await click(box(/Shares \(equities\)/));
    await tick(10);

    const sent = countRequests(api).slice(before);
    expect(sent).toHaveLength(2);
    expect(sent[0][1]!.aborted).toBe(true);
    expect(sent[1][1]!.aborted).toBe(false);
    expect(sent[1][0]).toEqual({ kind: ['equity', 'etf'], search_text: 'a', include: ['count', 'facets'] });
    expect(screen.getAllByText('834').length).toBeGreaterThan(0);
  });

  it('leaves order_by out of the counts request', async () => {
    const api = await setup();
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.asc' } });
    await tick(0);
    const before = countRequests(api).length;

    await tickOption(/ETFs/);

    expect(countRequests(api)).toHaveLength(before + 1);
    expect(countRequests(api).at(-1)![0]).not.toHaveProperty('order_by');
  });

  it('ignores the response for a superseded state and aborts its request', async () => {
    const api = await setup();
    const first = deferred<Awaited<ReturnType<FakeApi['searchIndex']>>>();
    const second = deferred<Awaited<ReturnType<FakeApi['searchIndex']>>>();
    const signals: AbortSignal[] = [];
    const base = api.searchIndex.getMockImplementation()!;
    const stale = { ...(await base({ search_text: 'a', include: ['count', 'facets'] })), count: 999 };
    api.searchIndex.mockImplementationOnce(async (_body, signal) => (signals.push(signal!), first.promise));
    api.searchIndex.mockImplementationOnce(async (_body, signal) => (signals.push(signal!), second.promise));

    await tickOption(/ETFs/);
    await tickOption(/Shares \(equities\)/);
    expect(signals[0].aborted).toBe(true);

    await act(async () => first.resolve(stale));
    await tick(10);
    expect(screen.queryByText(/999/)).toBeNull();
    expect(screen.getByRole('button', { name: /Counting results/ })).toBeTruthy();

    await act(async () => second.resolve({ ...stale, count: 7 }));
    await tick(10);
    expect(applyButton()!.textContent).toBe('Show 7 results');
    expect(screen.queryByText(/999/)).toBeNull();
  });

  it('sends no results request until the button, then exactly one with the applied filters', async () => {
    const api = await setup();
    const before = resultRequests(api).length;

    await tickOption(/ETFs/);
    expect(resultRequests(api)).toHaveLength(before);

    await click(applyButton()!);
    await tick(10);
    expect(resultRequests(api)).toHaveLength(before + 1);
    expect(resultRequests(api).at(-1)![0]).toMatchObject({ kind: ['etf'], search_text: 'a' });
    // The drawer's exit animation may still be running, so check the trigger's state, not the DOM.
    expect(filtersTrigger()!.getAttribute('aria-expanded')).toBe('false');
    expect(filtersTrigger()!.textContent).toBe('Filters (1)');
  });

  it('discards the pending ticks when the drawer is closed, and reopens from the applied filters', async () => {
    const api = await setup();
    const before = resultRequests(api).length;

    await tickOption(/ETFs/);
    await click(screen.getByRole('button', { name: 'Close filters' }));
    await tick(10);

    expect(resultRequests(api)).toHaveLength(before);
    expect(filtersTrigger()!.textContent).toBe('Filters');
    await openDrawer();
    expect(box(/ETFs/).checked).toBe(false);
  });

  it('ORs within a section and ANDs across sections', async () => {
    const api = await setup();
    await click(box(/ETFs/));
    await click(box(/Shares \(equities\)/));
    await click(box(/Betashares funds only/));
    await click(screen.getByRole('radio', { name: /100 to 500 million/ }));
    await tick(0);

    expect(countRequests(api).at(-1)![0]).toMatchObject({
      kind: ['equity', 'etf'],
      is_betashares: { value: true },
      units_circulating: { min: '100000000', max: '500000000' },
    });
  });

  it('shows the count on the button, also with no pending changes', async () => {
    await setup((body) => ({ count: body.kind ? 1240 : undefined }));
    expect(applyButton()!.textContent).toBe('Show 834 results');

    await tickOption(/ETFs/);
    expect(applyButton()!.textContent).toBe('Show 1,240 results');
  });

  it.each([
    [1, 'Show 1 result', false],
    [31, 'Show 31 results', false],
    [0, 'No matching results', true],
  ])('shows %i as "%s"', async (count, text, disabled) => {
    await setup((body) => ({ count: body.kind ? count : undefined }));
    await tickOption(/ETFs/);

    expect(applyButton()!.textContent).toBe(text);
    expect(applyButton()!.disabled).toBe(disabled);
  });

  it('Clear filters empties the ticks without applying them', async () => {
    const api = await setup();
    await tickOption(/ETFs/);
    await click(applyButton()!);
    await tick(10);
    await tickOption(/Shares \(equities\)/);
    const before = resultRequests(api).length;

    await click(screen.getByRole('button', { name: 'Clear filters' }));
    await tick(10);

    expect(box(/ETFs/).checked).toBe(false);
    expect(box(/Shares \(equities\)/).checked).toBe(false);
    expect(resultRequests(api)).toHaveLength(before);
    expect(rows().length).toBeGreaterThan(0);

    // Only the button applies, and the cleared state replaces the old kind filter.
    await tickOption(/Betashares funds only/);
    await click(applyButton()!);
    await tick(10);
    expect(resultRequests(api)).toHaveLength(before + 1);
    expect(resultRequests(api).at(-1)![0]).toMatchObject({ is_betashares: { value: true } });
    expect(resultRequests(api).at(-1)![0]).not.toHaveProperty('kind');
  });

  it('discards the pending ticks when the viewport grows to tablet with the drawer open', async () => {
    const api = await setup();
    const original = window.matchMedia;
    let tablet = false;
    type Listener = (event: { matches: boolean; media: string }) => void;
    const listeners = new Set<[string, Listener]>();
    window.matchMedia = ((query: string) => ({
      ...original(query),
      get matches() {
        return tablet;
      },
      addEventListener: (_type: string, listener: Listener) => void listeners.add([query, listener]),
      removeEventListener: (_type: string, listener: Listener) => listeners.forEach((entry) => entry[1] === listener && listeners.delete(entry)),
    })) as unknown as typeof window.matchMedia;
    try {
      // Chakra reads matchMedia on mount, so remount under the controllable stub.
      cleanup();
      vi.useRealTimers();
      renderApp(api);
      await search('a');
      fireEvent.click(filtersTrigger()!);
      fireEvent.click(await screen.findByRole('checkbox', { name: /ETFs/ }));
      await waitFor(() => expect(box(/ETFs/).checked).toBe(true));
      const requests = resultRequests(api).length;

      tablet = true;
      act(() => listeners.forEach(([media, listener]) => listener({ matches: true, media })));
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(resultRequests(api)).toHaveLength(requests);
      expect(resultRequests(api).some(([body]) => body.kind)).toBe(false);
      expect((await screen.findByRole('checkbox', { name: /ETFs/ }) as HTMLInputElement).checked).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it('a new search clears applied filters and keeps the sort', async () => {
    const api = await setup();
    await tickOption(/ETFs/);
    await click(applyButton()!);
    await tick(10);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.desc' } });
    await tick(10);

    vi.useRealTimers();
    await search('b');
    await waitFor(() => expect(resultRequests(api).at(-1)![0]).toMatchObject({ search_text: 'b', order_by: 'symbol.desc' }));

    expect(resultRequests(api).at(-1)![0]).not.toHaveProperty('kind');
    expect(screen.queryByRole('list', { name: 'Applied filters' })).toBeNull();
    expect(filtersTrigger()!.textContent).toBe('Filters');
    fireEvent.click(filtersTrigger()!);
    expect((await screen.findByRole('checkbox', { name: /ETFs/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('disables a zero-count option, and keeps it enabled once selected', async () => {
    await setup((body) => ({
      facets: {
        ...fakeFacets(834),
        kind: [{ value: 'equity', count: body.kind?.includes('equity') ? 0 : 5 }, { value: 'etf', count: 5 }],
        is_flagship_fund: [{ value: 'true', count: 0 }, { value: 'false', count: 5 }],
      },
    }));
    await tick(0);
    expect(box(/Flagship funds/).disabled).toBe(true);
    expect(box(/Shares \(equities\)/).disabled).toBe(false);

    await tickOption(/Shares \(equities\)/);
    expect(box(/Shares \(equities\)/).checked).toBe(true);
    expect(box(/Shares \(equities\)/).disabled).toBe(false);
  });

  describe('when the counts request fails', () => {
    const failNextCounts = (api: FakeApi) => {
      const base = api.searchIndex.getMockImplementation()!;
      api.searchIndex.mockImplementationOnce(async () => {
        throw new Error('boom');
      });
      return base;
    };
    const noNumbers = () => expect(screen.queryByText('834')).toBeNull();

    it.each([
      ['on the first counts response', false],
      ['after an earlier successful response', true],
    ])('shows a retry, no numbers and an enabled Apply, %s', async (_name, afterSuccess) => {
      const api = await setup();
      if (afterSuccess) {
        await tickOption(/ETFs/);
        expect(screen.getAllByText('834').length).toBeGreaterThan(0);
      }
      failNextCounts(api);
      await tickOption(afterSuccess ? /Shares \(equities\)/ : /ETFs/);

      expect(screen.getByText("Couldn't update the counts.")).toBeTruthy();
      noNumbers();
      expect(applyButton()!.textContent).toBe('Show results');
      expect(applyButton()!.disabled).toBe(false);
      expect(box(/Shares \(equities\)/).disabled).toBe(false);

      const before = countRequests(api).length;
      await click(screen.getByRole('button', { name: 'Retry' }));
      await tick(10);

      expect(countRequests(api)).toHaveLength(before + 1);
      expect(screen.queryByText("Couldn't update the counts.")).toBeNull();
      expect(screen.getAllByText('834').length).toBeGreaterThan(0);
    });
  });

  it('keeps the units section the same height before and after the counts arrive', async () => {
    const api = fakeApi();
    const first = deferred<Awaited<ReturnType<FakeApi['searchIndex']>>>();
    const base = api.searchIndex.getMockImplementation()!;
    api.searchIndex.mockImplementation((body, signal) => (isCounts(body) ? first.promise : base(body, signal)));
    renderApp(api);
    await search('a');
    fireEvent.click(filtersTrigger()!);
    await screen.findByRole('dialog');
    const radios = () => screen.getAllByRole('radio', { hidden: true }).length;
    const before = radios();

    await act(async () => first.resolve(await base({ search_text: 'a', include: ['count', 'facets'] })));
    await waitFor(() => expect(screen.getAllByText('834').length).toBeGreaterThan(0));

    expect(before).toBe(6);
    expect(radios()).toBe(before);
  });

  describe('issuer section', () => {
    const issuerBox = (name: RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
    const showAll = () => screen.getByRole('button', { name: /^Show all/ });

    it('shows the top 8 issuers, then every issuer with a filter box after Show all', async () => {
      await setup();
      expect(screen.getAllByRole('checkbox', { name: /Acme|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Investors/ })).toHaveLength(8);
      expect(screen.queryByRole('checkbox', { name: /India/ })).toBeNull();
      expect(screen.queryByLabelText('Filter issuers')).toBeNull();
      expect(showAll().textContent).toBe('Show all 11');
      expect(showAll().getAttribute('aria-expanded')).toBe('false');

      await click(showAll());
      expect(screen.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getAllByRole('checkbox', { name: /Acme|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Investors/ })).toHaveLength(11);

      fireEvent.change(screen.getByLabelText('Filter issuers'), { target: { value: 'IND' } });
      expect(issuerBox(/India/)).toBeTruthy();
      expect(screen.queryByRole('checkbox', { name: /Acme/ })).toBeNull();

      fireEvent.change(screen.getByLabelText('Filter issuers'), { target: { value: 'zzz' } });
      expect(screen.getByText('No issuers match')).toBeTruthy();

      await click(screen.getByRole('button', { name: 'Show fewer' }));
      expect(screen.queryByLabelText('Filter issuers')).toBeNull();
      expect(screen.queryByRole('checkbox', { name: /India/ })).toBeNull();
    });

    it('matches the filter text against the raw slug too, to tell look-alikes apart', async () => {
      await setup();
      await click(showAll());
      fireEvent.change(screen.getByLabelText('Filter issuers'), { target: { value: ' Investors_Mutual ' } });
      // Look-alikes share one label; the slug match narrows them to one.
      expect(screen.getAllByRole('checkbox', { name: /Investors Mutual/ })).toHaveLength(1);
      expect(screen.queryByRole('checkbox', { name: /Acme/ })).toBeNull();
    });

    it('sends the slug in the counts request and keeps it pending until the button', async () => {
      const api = await setup();
      const before = resultRequests(api).length;

      await click(showAll());
      await click(screen.getAllByRole('checkbox', { name: /Investors Mutual/ })[1]);
      await tick(10);
      await tick(10);

      expect(countRequests(api).at(-1)![0]).toMatchObject({ issuer: ['investors_mutual'] });
      expect(resultRequests(api)).toHaveLength(before);
      await click(applyButton()!);
      await tick(10);
      expect(resultRequests(api).at(-1)![0]).toMatchObject({ issuer: ['investors_mutual'] });
      expect(filtersTrigger()!.textContent).toBe('Filters (1)');
    });
  });

  describe('beside the results (tablet and up)', () => {
    const mobileMatchMedia = window.matchMedia;
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({ ...mobileMatchMedia(query), matches: true })) as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = mobileMatchMedia;
    });

    it('applies a tick at once, with no apply button', async () => {
      const api = await setup();
      const before = resultRequests(api).length;

      await click(box(/ETFs/));
      await tick(10);

      expect(resultRequests(api)).toHaveLength(before + 1);
      expect(resultRequests(api).at(-1)![0]).toMatchObject({ kind: ['etf'], search_text: 'a' });
      expect(applyButton()).toBeNull();
    });

    it('keeps the previous results, dimmed and busy, until the refined results arrive', async () => {
      const api = await setup();
      const pending = deferred<Awaited<ReturnType<FakeApi['searchIndex']>>>();
      const base = api.searchIndex.getMockImplementation()!;
      api.searchIndex.mockImplementation((body, signal) => (!isCounts(body) && body.kind ? pending.promise : base(body, signal)));
      const shown = rows().length;

      await tickOption(/ETFs/);

      expect(skeletonRows()).toHaveLength(0);
      expect(rows()).toHaveLength(shown);
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('834 results');
      expect(rows()[0].closest('[aria-busy="true"]')).not.toBeNull();
      expect((screen.getByRole('button', { name: 'Load more' }) as HTMLButtonElement).disabled).toBe(true);

      await act(async () => pending.resolve({ ...(await base({ search_text: 'a', include: ['count', 'ids', 'documents'] })), count: 3, documents: [] }));
      await tick(10);

      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('3 results');
      expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    });

    it('applies an issuer tick live, with its slug', async () => {
      const api = await setup();
      const before = resultRequests(api).length;

      await click(box(/Acme/));
      await tick(10);

      expect(resultRequests(api)).toHaveLength(before + 1);
      expect(resultRequests(api).at(-1)![0]).toMatchObject({ issuer: ['acme'] });
    });

    it('cancels the earlier results request when a second tick follows, and shows the latest results', async () => {
      const api = await setup();
      const before = resultRequests(api).length;
      hangUntilAborted(api, (body) => !isCounts(body) && onlyEtf(body));

      await click(box(/ETFs/));
      await click(box(/Shares \(equities\)/));
      await tick(10);

      const sent = resultRequests(api).slice(before);
      expect(sent).toHaveLength(2);
      expect(sent[0][1]!.aborted).toBe(true);
      expect(sent[1][1]!.aborted).toBe(false);
      expect(sent[1][0]).toMatchObject({ kind: ['equity', 'etf'] });
      expect(rows().length).toBeGreaterThan(0);
    });
  });
});
