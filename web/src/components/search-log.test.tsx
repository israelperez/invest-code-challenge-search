// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, fake, fakeApi, renderApp, rows, search, type FakeApi } from '../../tests/component/app-harness';

const input = () => screen.getByLabelText('Search shares and ETFs') as HTMLInputElement;
const logged = (api: FakeApi) => api.logSearch.mock.calls.map(([term]) => term);
const resultRequests = (api: FakeApi) => api.searchIndex.mock.calls.filter(([body]) => body.include?.includes('documents'));

beforeEach(() => {
  fake.indexedAt = 1;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Search logging', () => {
  it('logs a typed submit once', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('b');

    expect(logged(api)).toEqual(['b']);
  });

  it('logs a suggestion pick once', async () => {
    const api = fakeApi();
    renderApp(api);
    act(() => input().focus());
    fireEvent.change(input(), { target: { value: 'glo' } });
    fireEvent.click(await screen.findByRole('option', { name: /ARMR/ }));
    await screen.findByRole('heading', { level: 2 });

    expect(logged(api)).toEqual(['ARMR']);
  });

  it('logs a repeated search again without another results request', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('b');
    const before = resultRequests(api).length;

    await search('b');

    expect(logged(api)).toEqual(['b', 'b']);
    expect(resultRequests(api)).toHaveLength(before);
  });

  it('logs search A and then B when B is submitted before A lands', async () => {
    const api = fakeApi();
    const base = api.searchIndex.getMockImplementation()!;
    const slowA = deferred<void>();
    api.searchIndex.mockImplementation(async (body, signal) => {
      if (body.search_text === 'a') await slowA.promise;
      return base(body, signal);
    });
    renderApp(api);

    fireEvent.change(input(), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await search('b');
    slowA.resolve();

    expect(logged(api)).toEqual(['a', 'b']);
  });

  it('does not log refinements, load more, counts or the initial load', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    expect(logged(api)).toEqual(['a']);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(rows()).toHaveLength(30));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.desc' } });
    await waitFor(() => expect(rows()[0].textContent).toContain('A0833'));
    const trigger = screen.queryByRole('button', { name: /^Filters/ });
    if (trigger) fireEvent.click(trigger);
    await waitFor(() => expect((screen.getByRole('checkbox', { name: /ETFs/ }) as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('checkbox', { name: /ETFs/ }));
    await waitFor(() => expect(api.searchIndex.mock.calls.some(([body]) => body.kind?.includes('etf') && !body.include?.includes('documents'))).toBe(true));

    expect(logged(api)).toEqual(['a']);
  });

  it('shows nothing to the user when logging fails', async () => {
    const api = fakeApi();
    api.logSearch.mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp(api);
    await search('b');

    await waitFor(() => expect(api.logSearch).toHaveBeenCalled());
    expect(rows()).toHaveLength(15);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
