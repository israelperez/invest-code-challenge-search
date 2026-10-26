// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { catalogues, deferred, doc, fake, fakeApi, renderApp, rows, search, skeletonRows, type FakeApi } from '../../tests/component/app-harness';
import { config } from '../config';

const loadMoreButton = () => screen.queryByRole('button', { name: 'Load more' });
const status = () => screen.getByRole('status');

async function clickLoadMore() {
  await act(async () => {
    fireEvent.click(loadMoreButton()!);
  });
}

beforeEach(() => {
  fake.indexedAt = 1;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Load more', () => {
  it('shows skeleton rows while loading, then appends the batch atomically and focuses its first row', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    expect(rows()).toHaveLength(15);

    const batch = deferred<Awaited<ReturnType<FakeApi['instrumentsBatch']>>>();
    api.instrumentsBatch.mockReturnValueOnce(batch.promise);
    await clickLoadMore();

    expect(skeletonRows()).toHaveLength(config.skeletonRows);
    expect(rows()).toHaveLength(15);

    // 15 to 17 came with the first batch (document_limit 15 + orphanSize), so only the rest is requested.
    const ids = catalogues.a.slice(18, 30);
    await act(async () => batch.resolve({ documents: ids.map(doc), missing: [], indexed_at: fake.indexedAt }));

    expect(skeletonRows()).toHaveLength(0);
    expect(rows()).toHaveLength(30);
    expect(document.activeElement).toBe(rows()[15]);
    expect(rows()[15].getAttribute('tabindex')).toBe('-1');
    expect(status().textContent).toBe('15 more loaded, showing 30 of 834');
    expect(api.instrumentsBatch.mock.calls[0][0]).toEqual({ ids, snapshot: 1 });
  });

  it('skips IDs the batch reports missing, logs them, and still moves past them', async () => {
    const api = fakeApi();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderApp(api);
    await search('a');

    const ids = catalogues.a.slice(18, 30);
    const missing = [ids[3], ids[9]];
    api.instrumentsBatch.mockResolvedValueOnce({
      documents: ids.filter((id) => !missing.includes(id)).map(doc),
      missing,
      indexed_at: 1,
    });
    await clickLoadMore();

    expect(rows()).toHaveLength(28);
    expect(status().textContent).toBe('13 more loaded, showing 28 of 834');
    expect(warn).toHaveBeenCalledWith(expect.any(String), missing);

    await clickLoadMore();
    expect(api.instrumentsBatch.mock.calls[1][0].ids).toEqual(catalogues.a.slice(30, 45));
  });

  it('keeps the rows on failure, shows an inline error with Retry, and recovers on Retry', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.instrumentsBatch.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await clickLoadMore();
    expect(error).toHaveBeenCalledWith('Loading more results failed', expect.objectContaining({ status: 500 }));

    expect(rows()).toHaveLength(15);
    expect(loadMoreButton()).toBeNull();
    expect(screen.getByText(/could not load more/i)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(rows()).toHaveLength(30);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(loadMoreButton()).toBeTruthy();
  });

  it('cancels an in-flight load more when a new search starts, ignoring its late response', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');

    const batch = deferred<Awaited<ReturnType<FakeApi['instrumentsBatch']>>>();
    api.instrumentsBatch.mockReturnValueOnce(batch.promise);
    await clickLoadMore();
    const signal = api.instrumentsBatch.mock.calls[0][1]!;

    await search('b');
    await waitFor(() => expect(rows()[0].textContent).toContain('B0000'));
    expect(signal.aborted).toBe(true);

    await act(async () =>
      batch.resolve({ documents: catalogues.a.slice(15, 30).map(doc), missing: [], indexed_at: 1 }),
    );

    expect(rows()).toHaveLength(15);
    expect(rows().every((row) => row.textContent?.includes('Fund B'))).toBe(true);
    expect(skeletonRows()).toHaveLength(0);
    expect(status().textContent).toBe('');
  });

  it('shows all 18 results at once, with no Load more and no end message', async () => {
    renderApp(fakeApi());
    await search('c');

    expect(rows()).toHaveLength(18);
    expect(loadMoreButton()).toBeNull();
    expect(screen.queryByText(/end of the results/i)).toBeNull();
  });

  it('shows 15 of 19, then the last 4 on Load more, then the end message', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('d');
    expect(rows()).toHaveLength(15);
    expect(screen.queryByText(/end of the results/i)).toBeNull();

    await clickLoadMore();

    expect(rows()).toHaveLength(19);
    expect(status().textContent).toBe('4 more loaded, showing 19 of 19');
    // Documents 15 to 17 were inlined with the first batch, so only the 19th is requested.
    expect(api.instrumentsBatch.mock.calls[0][0].ids).toEqual(catalogues.d.slice(18));
    expect(loadMoreButton()).toBeNull();
    expect(screen.getByText(/end of the results/i)).toBeTruthy();
  });

  it('replaces the button with an end-of-results message after the last batch', async () => {
    renderApp(fakeApi());
    await search('b');
    expect(loadMoreButton()).toBeTruthy();
    expect(screen.queryByText(/end of the results/i)).toBeNull();

    await clickLoadMore();

    expect(rows()).toHaveLength(20);
    expect(loadMoreButton()).toBeNull();
    expect(screen.getByText(/end of the results/i)).toBeTruthy();
    expect(status().textContent).toBe('5 more loaded, showing 20 of 20');
  });

  it('on a 409 reloads the first batch in place, focuses the heading and announces the refresh', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    await clickLoadMore();
    expect(rows()).toHaveLength(30);

    // The API restarts on new data: the next batch call is stale and the first batch comes back as v2.
    fake.indexedAt = 2;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.instrumentsBatch.mockRejectedValueOnce(new ApiError(409, 'stale', { indexed_at: 2 }));
    const reload = deferred<Awaited<ReturnType<FakeApi['searchIndex']>>>();
    api.searchIndex.mockReturnValueOnce(reload.promise);
    await clickLoadMore();

    // Old rows stay until the reloaded first batch arrives.
    expect(rows()).toHaveLength(30);
    expect(rows()[0].textContent).toContain('v1');

    const ids = catalogues.a.slice(0, 15);
    await act(async () =>
      reload.resolve({ indexed_at: 2, count: 834, ids: catalogues.a, next_id_offset: null, documents: ids.map(doc) }),
    );

    await waitFor(() => expect(status().textContent).toBe('Results were refreshed'));
    expect(rows()).toHaveLength(15);
    expect(rows()[0].textContent).toContain('v2');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
    expect(loadMoreButton()).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('restarting'));
  });

  it('logs and shows the retry state when the batch response leaves a requested ID unaccounted for', async () => {
    const api = fakeApi();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp(api);
    await search('a');
    const ids = catalogues.a.slice(18, 30);
    api.instrumentsBatch.mockResolvedValueOnce({ documents: ids.slice(1).map(doc), missing: [], indexed_at: 1 });
    await clickLoadMore();

    expect(rows()).toHaveLength(15);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(error).toHaveBeenCalledWith(
      'Loading more results failed',
      expect.objectContaining({ message: expect.stringContaining(ids[0]) }),
    );
  });

  it('logs when the first batch fails', async () => {
    const api = fakeApi();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.searchIndex.mockRejectedValueOnce(new ApiError(500, 'boom'));
    renderApp(api);
    fireEvent.change(screen.getByLabelText('Search instruments'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText('Something went wrong');
    expect(error).toHaveBeenCalledWith('Loading the first batch failed', expect.objectContaining({ status: 500 }));
  });
});
