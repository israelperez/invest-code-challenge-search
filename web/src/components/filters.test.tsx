// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FacetEntry, SearchIndexRequest } from '../../src/api/types';
import { deferred, fake, fakeApi, fakeFacets, renderApp, rows, search, type FakeApi } from '../../tests/component/app-harness';
import { config } from '../config';

const isCounts = (body: SearchIndexRequest) => !body.include?.includes('documents');
const countRequests = (api: FakeApi) => api.searchIndex.mock.calls.filter(([body]) => isCounts(body));
const resultRequests = (api: FakeApi) => api.searchIndex.mock.calls.filter(([body]) => !isCounts(body));
const box = (name: RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const applyButton = () => screen.queryByRole('button', { name: /^(Show|No matching)/ }) as HTMLButtonElement | null;
// Fake timers only for setTimeout, so promises and Testing Library polling keep working.
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
// The checkbox reports its change a microtask after the click, so let it land before the clock moves.
const click = async (element: HTMLElement) => {
  fireEvent.click(element);
  await tick(0);
};
const tickOption = async (name: RegExp) => {
  await click(box(name));
  await tick(config.countsDebounceMs);
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

describe('Filters', () => {
  it('sends one counts-only request for two quick ticks', async () => {
    const api = await setup();
    const before = countRequests(api).length;

    await click(box(/ETFs/));
    await tick(50);
    await click(box(/Stocks/));
    await tick(config.countsDebounceMs);

    const sent = countRequests(api);
    expect(sent).toHaveLength(before + 1);
    expect(sent.at(-1)![0]).toEqual({ kind: ['equity', 'etf'], search_text: 'a', include: ['count', 'facets'] });
  });

  it('leaves order_by out of the counts request', async () => {
    const api = await setup();
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.asc' } });
    await tick(config.countsDebounceMs);
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
    await tickOption(/Stocks/);
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
    expect(applyButton()).toBeNull();
  });

  it('ORs within a section and ANDs across sections', async () => {
    const api = await setup();
    await click(box(/ETFs/));
    await click(box(/Stocks/));
    await click(box(/Betashares funds only/));
    await click(screen.getByRole('radio', { name: /100 to 500 million/ }));
    await tick(config.countsDebounceMs);

    expect(countRequests(api).at(-1)![0]).toMatchObject({
      kind: ['equity', 'etf'],
      is_betashares: { value: true },
      units_circulating: { min: '100000000', max: '500000000' },
    });
  });

  it('is hidden with no pending changes, and shows the count on the button', async () => {
    await setup((body) => ({ count: body.kind ? 1240 : undefined }));
    expect(applyButton()).toBeNull();

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
    await tickOption(/Stocks/);
    const before = resultRequests(api).length;

    await click(screen.getByRole('button', { name: 'Clear filters' }));
    await tick(config.countsDebounceMs + 10);

    expect(box(/ETFs/).checked).toBe(false);
    expect(box(/Stocks/).checked).toBe(false);
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

  it('keeps applied filters and discards pending ticks on a new search', async () => {
    const api = await setup();
    await tickOption(/ETFs/);
    await click(applyButton()!);
    await tick(10);
    await tickOption(/Stocks/);

    vi.useRealTimers();
    await search('b');
    await waitFor(() => expect(resultRequests(api).at(-1)![0]).toMatchObject({ search_text: 'b', kind: ['etf'] }));

    expect(box(/ETFs/).checked).toBe(true);
    expect(box(/Stocks/).checked).toBe(false);
    expect(applyButton()).toBeNull();
  });

  it('disables a zero-count option, and keeps it enabled once selected', async () => {
    await setup((body) => ({
      facets: {
        ...fakeFacets(834),
        kind: [{ value: 'equity', count: body.kind?.includes('equity') ? 0 : 5 }, { value: 'etf', count: 5 }],
        is_flagship_fund: [{ value: 'true', count: 0 }, { value: 'false', count: 5 }],
      },
    }));
    await tick(config.countsDebounceMs);
    expect(box(/Flagship funds/).disabled).toBe(true);
    expect(box(/Stocks/).disabled).toBe(false);

    await tickOption(/Stocks/);
    expect(box(/Stocks/).checked).toBe(true);
    expect(box(/Stocks/).disabled).toBe(false);
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
      await tickOption(afterSuccess ? /Stocks/ : /ETFs/);

      expect(screen.getByText("Couldn't update the counts.")).toBeTruthy();
      noNumbers();
      expect(applyButton()!.textContent).toBe('Show results');
      expect(applyButton()!.disabled).toBe(false);
      expect(box(/Stocks/).disabled).toBe(false);

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
    const radios = () => screen.getAllByRole('radio', { hidden: true }).length;
    const before = radios();

    await act(async () => first.resolve(await base({ search_text: 'a', include: ['count', 'facets'] })));
    await waitFor(() => expect(screen.getAllByText('834').length).toBeGreaterThan(0));

    expect(before).toBe(6);
    expect(radios()).toBe(before);
  });
});
