// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deferred, fake, fakeApi, renderApp, rows, search, skeletonRows, type FakeApi } from '../../tests/component/app-harness';

const LABELS = [
  'Best match',
  'Exchange code (ticker) A – Z',
  'Exchange code (ticker) Z – A',
  'Investment name A – Z',
  'Investment name Z – A',
  'Shares issued high – low',
  'Shares issued low – high',
];
const sortSelect = () => screen.getByLabelText('Sort by') as HTMLSelectElement;
const pick = (label: string) =>
  fireEvent.change(sortSelect(), { target: { value: within(sortSelect()).getByRole('option', { name: label }).getAttribute('value') } });
const lastRequest = (api: FakeApi) => api.searchIndex.mock.calls.at(-1)![0];

beforeEach(() => {
  fake.indexedAt = 1;
});
afterEach(cleanup);

describe('Sort', () => {
  it('offers the seven options in order, with Best match selected', async () => {
    renderApp(fakeApi());
    await search('a');

    expect(within(sortSelect()).getAllByRole('option').map((o) => o.textContent)).toEqual(LABELS);
    expect(sortSelect().selectedOptions[0].textContent).toBe('Best match');
  });

  it.each([
    ['Exchange code (ticker) A – Z', 'symbol.asc'],
    ['Exchange code (ticker) Z – A', 'symbol.desc'],
    ['Investment name A – Z', 'display_name.asc'],
    ['Investment name Z – A', 'display_name.desc'],
    ['Shares issued high – low', 'units_circulating.desc'],
    ['Shares issued low – high', 'units_circulating.asc'],
  ])('%s sends order_by %s', async (label, orderBy) => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    expect(lastRequest(api)).not.toHaveProperty('order_by');

    pick(label);
    await waitFor(() => expect(lastRequest(api)).toHaveProperty('order_by', orderBy));
  });

  it('Best match omits order_by again', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    pick('Investment name A – Z');
    await search('b');
    expect(lastRequest(api)).toHaveProperty('order_by', 'display_name.asc');

    // "b" has not been fetched unsorted yet, so this is a fresh request.
    pick('Best match');
    await waitFor(() => expect(lastRequest(api)).not.toHaveProperty('order_by'));
    expect(sortSelect().selectedOptions[0].textContent).toBe('Best match');
  });

  it('keeps the term and filters, and resets to the first batch in the new order', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    const before = lastRequest(api);
    expect(before.search_text).toBe('a');
    expect(Object.keys(before).filter((k) => !['search_text', 'include', 'id_limit', 'document_limit'].includes(k))).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    pick('Exchange code (ticker) Z – A');
    await waitFor(() => expect(rows()[0].textContent).toContain('A0833'));

    expect(lastRequest(api)).toEqual({ ...before, order_by: 'symbol.desc' });
    expect(rows()).toHaveLength(15);
    expect(rows()[14].textContent).toContain('A0819');
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  it('persists across searches', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    pick('Exchange code (ticker) Z – A');
    await waitFor(() => expect(rows()[0].textContent).toContain('A0833'));

    await search('b');
    await waitFor(() => expect(rows()[0].textContent).toContain('B0019'));

    expect(lastRequest(api)).toMatchObject({ search_text: 'b', order_by: 'symbol.desc' });
    expect(sortSelect().selectedOptions[0].textContent).toBe('Exchange code (ticker) Z – A');
  });

  it('stays mounted and focused while the sorted first batch loads', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    const first = lastRequest(api);
    const select = sortSelect();
    select.focus();

    const sorted = deferred<Awaited<ReturnType<FakeApi['searchIndex']>>>();
    api.searchIndex.mockReturnValueOnce(sorted.promise);
    pick('Investment name Z – A');

    await waitFor(() => expect(skeletonRows().length).toBeGreaterThan(0));
    expect(sortSelect()).toBe(select);
    expect(document.activeElement).toBe(select);

    await act(async () => {
      sorted.resolve(await api.searchIndex({ ...first, order_by: 'display_name.desc' }));
    });
    await waitFor(() => expect(skeletonRows()).toHaveLength(0));
    expect(sortSelect()).toBe(select);
    expect(document.activeElement).toBe(select);
  });
});
