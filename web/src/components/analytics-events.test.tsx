// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { deferred, fake, fakeApi, freshRecentStore, renderApp, search, type FakeApi } from '../../tests/component/app-harness';

const input = () => screen.getByLabelText('Search shares and ETFs') as HTMLInputElement;
const names = (track: ReturnType<typeof vi.fn>) => track.mock.calls.map(([name]) => name);

// Chakra asks matchMedia for min-width queries; this answers them for a wide viewport, where filters apply beside the results.
const realMatchMedia = window.matchMedia;
function wide() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*([\d.]+)(px|rem|em)/.exec(query);
    const px = min ? Number(min[1]) * (min[2] === 'px' ? 1 : 16) : 0;
    return { ...realMatchMedia(query), matches: 1300 >= px };
  }) as typeof window.matchMedia;
}

let api: FakeApi;
beforeEach(() => {
  fake.indexedAt = 1;
  api = fakeApi();
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
  cleanup();
});

describe('Product events', () => {
  it('a typed search sends search_submitted with source typed', async () => {
    const { analytics } = renderApp(api);
    await search('a');
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith('search_submitted', { term: 'a', source: 'typed' });
  });

  it('picking an instrument suggestion sends suggestion_selected, then search_submitted with source suggestion', async () => {
    const { analytics } = renderApp(api);
    act(() => input().focus());
    fireEvent.change(input(), { target: { value: 'glo' } });
    fireEvent.click(await screen.findByRole('option', { name: /ARMR/ }));
    await screen.findByRole('heading', { level: 2 });
    expect(analytics.track).toHaveBeenNthCalledWith(1, 'suggestion_selected', { query: 'glo', value: 'ARMR', kind: 'instrument' });
    expect(analytics.track).toHaveBeenNthCalledWith(2, 'search_submitted', { term: 'ARMR', source: 'suggestion' });
  });

  it('picking a term suggestion has kind term', async () => {
    const { analytics } = renderApp(api);
    act(() => input().focus());
    fireEvent.change(input(), { target: { value: 'glo' } });
    fireEvent.click(await screen.findByRole('option', { name: /Global X/ }));
    await screen.findByRole('heading', { level: 2 });
    expect(analytics.track).toHaveBeenCalledWith('suggestion_selected', { query: 'glo', value: 'Global X', kind: 'term' });
  });

  it('a popular pill sends search_submitted with source popular', async () => {
    const { analytics } = renderApp(api);
    fireEvent.click(await screen.findByRole('button', { name: 'A200' }));
    await screen.findByRole('heading', { level: 2 });
    expect(analytics.track).toHaveBeenCalledWith('search_submitted', { term: 'A200', source: 'popular' });
  });

  it('a recent pick sends search_submitted with source recent and no suggestion_selected', async () => {
    const recent = freshRecentStore();
    recent.add('b');
    const { analytics } = renderApp(api, { recent });
    act(() => input().focus());
    fireEvent.click(await screen.findByRole('option', { name: /^b/ }));
    await screen.findByRole('heading', { level: 2 });
    expect(names(analytics.track as never)).toEqual(['search_submitted']);
    expect(analytics.track).toHaveBeenCalledWith('search_submitted', { term: 'b', source: 'recent' });
  });

  it('a search with no results sends search_zero_results once, filtered false', async () => {
    const { analytics } = renderApp(api);
    await search('none');
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(analytics.track).toHaveBeenCalledWith('search_zero_results', { term: 'none', filtered: false });
    expect(names(analytics.track as never).filter((n) => n === 'search_zero_results')).toHaveLength(1);
  });

  it('a search with no results under applied filters sends filtered true', async () => {
    wide();
    const { analytics } = renderApp(api);
    await search('a');
    fireEvent.click(await screen.findByRole('checkbox', { name: /ETFs/ }));
    await waitFor(() => expect(api.searchIndex.mock.calls.some(([b]) => b.include?.includes('documents') && b.kind)).toBe(true));
    await search('none');
    await waitFor(() => expect(analytics.track).toHaveBeenCalledWith('search_zero_results', { term: 'none', filtered: true }));
  });

  it('refinements (filter tick, sort change, load more) send none of the three events', async () => {
    wide();
    const { analytics } = renderApp(api);
    await search('a');
    vi.mocked(analytics.track).mockClear();

    fireEvent.click(await screen.findByRole('checkbox', { name: /ETFs/ }));
    await waitFor(() => expect(api.searchIndex.mock.calls.some(([b]) => b.include?.includes('documents') && b.kind)).toBe(true));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.asc' } });
    await waitFor(() => expect(api.searchIndex.mock.calls.some(([b]) => b.include?.includes('documents') && b.order_by)).toBe(true));
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Load more' })));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(analytics.track).not.toHaveBeenCalled();
  });

  describe('a refinement made before the submitted search responds', () => {
    // 'b' with the ETFs filter is the submission; its response is held. Any other request for 'b' is a refinement and returns nothing.
    async function inFlight() {
      wide();
      const recent = freshRecentStore();
      const { analytics } = renderApp(api, { recent });
      await search('a');
      fireEvent.click(await screen.findByRole('checkbox', { name: /ETFs/ }));
      await screen.findByRole('list', { name: 'Applied filters' });
      const slow = deferred<void>();
      const real = api.searchIndex.getMockImplementation()!;
      api.searchIndex.mockImplementation(async (body, signal) => {
        if (body.search_text !== 'b' || !body.include?.includes('documents')) return real(body, signal);
        if (body.kind?.join() === 'etf' && !body.order_by) {
          await slow.promise;
          return real(body, signal);
        }
        if (refinementFails) throw new ApiError(500, 'boom');
        return { indexed_at: 1, count: 0, ids: [], next_id_offset: null, documents: [] };
      });
      fireEvent.change(input(), { target: { value: 'b' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      return { analytics, recent, slow };
    }
    // The checkboxes stay disabled until the counts for the new search land.
    async function tickEquities() {
      const box = () => screen.getByRole('checkbox', { name: /Shares \(equities\)/ }) as HTMLInputElement;
      await waitFor(() => expect(box().disabled).toBe(false));
      await act(async () => fireEvent.click(box()));
    }
    const settle = () => act(() => new Promise((r) => setTimeout(r, 400)));
    let refinementFails = false;
    beforeEach(() => (refinementFails = false));

    async function expectNothing({ analytics, recent, slow }: Awaited<ReturnType<typeof inFlight>>) {
      await settle();
      slow.resolve();
      await settle();
      expect(names(analytics.track as never)).not.toContain('search_zero_results');
      expect(recent.list()).not.toContain('b');
    }

    it('a filter tick', async () => {
      const ctx = await inFlight();
      await tickEquities();
      await expectNothing(ctx);
    });

    it('a sort change', async () => {
      const ctx = await inFlight();
      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.asc' } });
      await expectNothing(ctx);
    });

    it('a chip removal', async () => {
      const ctx = await inFlight();
      fireEvent.click(screen.getByRole('button', { name: 'Remove ETFs' }));
      await expectNothing(ctx);
    });

    it('a refinement that fails', async () => {
      refinementFails = true;
      const ctx = await inFlight();
      await tickEquities();
      await expectNothing(ctx);
    });
  });
});
