// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../api/client';
import { catalogues, deferred, doc, fake, fakeApi, renderApp, rows, search, skeletonRows, type FakeApi } from '../../tests/component/app-harness';
import { config } from '../config';
import type { Report } from '../search/report';

const MESSAGE_TITLE = 'The app seems to be experiencing issues';
const MESSAGE_BODY = 'Try again in a moment.';
// Reports that ADR 0007 removed: the gateway's major_failure covers them.
const removedEvents = (report: Report) => vi.mocked(report).mock.calls.filter(([event]) => (['first_batch_failed', 'load_more_failed', 'restart_failed'] as string[]).includes(event));
// While it runs, Chakra hides the label behind the spinner, so find the button by its text.
const retryButton = () => screen.getByText('Retry').closest('button')!;
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

  it('labels each row with its type, not the raw value', async () => {
    renderApp(fakeApi());
    await search('a');
    expect(rows()[0].textContent).toContain('ETF · Acme');
    expect(rows()[0].textContent).not.toContain('etf');
  });

  it('skips IDs the batch reports missing, logs them, and still moves past them', async () => {
    const api = fakeApi();
    const { report } = renderApp(api);
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
    expect(report).toHaveBeenCalledWith('batch_ids_missing', { level: 'warn', message: expect.any(String), detail: missing, entries: missing });

    await clickLoadMore();
    expect(api.instrumentsBatch.mock.calls[1][0].ids).toEqual(catalogues.a.slice(30, 45));
  });

  it('keeps the rows on failure, replaces the button with the major failure message, and recovers on Retry', async () => {
    const api = fakeApi();
    const { report } = renderApp(api);
    await search('a');

    api.instrumentsBatch.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await clickLoadMore();

    expect(rows()).toHaveLength(15);
    expect(loadMoreButton()).toBeNull();
    expect(screen.getByText(MESSAGE_TITLE)).toBeTruthy();
    expect(screen.getByText(MESSAGE_BODY)).toBeTruthy();
    expect(removedEvents(report)).toHaveLength(0);

    const retry = deferred<Awaited<ReturnType<typeof api.instrumentsBatch>>>();
    api.instrumentsBatch.mockReturnValueOnce(retry.promise);
    const batchCalls = api.instrumentsBatch.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    // Still mounted, disabled and not stacking a second request.
    expect(screen.getByText(MESSAGE_TITLE)).toBeTruthy();
    expect(retryButton().disabled).toBe(true);
    expect(api.instrumentsBatch).toHaveBeenCalledTimes(batchCalls + 1);
    await act(async () => {
      retry.resolve({ documents: catalogues.a.slice(18, 33).map(doc), missing: [], indexed_at: 1 });
    });

    expect(rows()).toHaveLength(30);
    expect(screen.queryByText(MESSAGE_TITLE)).toBeNull();
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
    const { report } = renderApp(api);
    await search('a');
    await clickLoadMore();
    expect(rows()).toHaveLength(30);

    // The API restarts on new data: the next batch call is stale and the first batch comes back as v2.
    fake.indexedAt = 2;
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
    expect(report).toHaveBeenCalledWith('snapshot_stale', { level: 'warn', message: expect.stringContaining('restarting') });
  });

  it('shows the major failure message under the rows when reloading after a stale snapshot fails', async () => {
    const api = fakeApi();
    const { report } = renderApp(api);
    await search('a');
    api.instrumentsBatch.mockRejectedValueOnce(new ApiError(409, 'stale', { indexed_at: 2 }));
    api.searchIndex.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await clickLoadMore();

    await screen.findByText(MESSAGE_TITLE);
    expect(rows()).toHaveLength(15);
    expect(loadMoreButton()).toBeNull();
    expect(removedEvents(report)).toHaveLength(0);
  });

  it('logs the incomplete batch and shows the major failure message when a requested ID is unaccounted for', async () => {
    const api = fakeApi();
    const { report } = renderApp(api);
    await search('a');
    const ids = catalogues.a.slice(18, 30);
    api.instrumentsBatch.mockResolvedValueOnce({ documents: ids.slice(1).map(doc), missing: [], indexed_at: 1 });
    await clickLoadMore();

    expect(rows()).toHaveLength(15);
    expect(screen.getByText(MESSAGE_TITLE)).toBeTruthy();
    expect(report).toHaveBeenCalledWith('batch_incomplete', { level: 'error', message: expect.any(String), detail: expect.arrayContaining([ids[0]]), entries: [ids[0]] });
    expect(removedEvents(report)).toHaveLength(0);
  });

  it('replaces the results area when the first batch fails, keeps the header and search, and Retry reruns it', async () => {
    const api = fakeApi();
    // Only the results request fails; the filter counts request runs alongside it.
    const base = api.searchIndex.getMockImplementation()!;
    let failing = true;
    const gate = deferred<void>();
    api.searchIndex.mockImplementation(async (body, signal) => {
      if (failing && body.include?.includes('documents')) throw new ApiError(500, 'boom');
      if (body.include?.includes('documents')) await gate.promise;
      return base(body, signal);
    });
    const { report } = renderApp(api);
    fireEvent.change(screen.getByLabelText('Search shares and ETFs'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText(MESSAGE_TITLE);
    expect(screen.getByText(MESSAGE_BODY)).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(rows()).toHaveLength(0);
    expect(screen.getByLabelText('Sort by')).toBeTruthy();
    expect((screen.getByLabelText('Search shares and ETFs') as HTMLInputElement).value).toBe('a');
    expect(removedEvents(report)).toHaveLength(0);

    failing = false;
    const calls = api.searchIndex.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    // Message stays mounted, Retry disabled, no skeleton swap, until the retry settles.
    expect(screen.getByText(MESSAGE_TITLE)).toBeTruthy();
    expect(retryButton().disabled).toBe(true);
    expect(skeletonRows()).toHaveLength(0);
    await act(async () => gate.resolve());
    await screen.findByRole('heading', { level: 2 });
    expect(api.searchIndex.mock.calls.slice(calls).some(([b]) => b.include?.includes('documents') && b.search_text === 'a')).toBe(true);
    expect(screen.queryByText(MESSAGE_TITLE)).toBeNull();
    expect(rows()).toHaveLength(15);
  });

  describe('an abandoned Retry that is still running', () => {
    // Plain 'a' fails its first batch, and its Retry then hangs; any other request (new term, sort) succeeds.
    async function stuckRetry() {
      const api = fakeApi();
      const base = api.searchIndex.getMockImplementation()!;
      let attempt = 0;
      api.searchIndex.mockImplementation(async (body, signal) => {
        if (body.include?.includes('documents') && body.search_text === 'a' && !body.order_by) {
          if (attempt++ === 0) throw new ApiError(500, 'boom');
          return new Promise(() => undefined);
        }
        return base(body, signal);
      });
      renderApp(api);
      fireEvent.change(screen.getByLabelText('Search shares and ETFs'), { target: { value: 'a' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      await screen.findByText(MESSAGE_TITLE);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      });
      expect(retryButton().disabled).toBe(true);
    }

    it('does not keep the message over the results of a new search', async () => {
      await stuckRetry();
      fireEvent.change(screen.getByLabelText('Search shares and ETFs'), { target: { value: 'b' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      await screen.findByRole('heading', { level: 2 });
      expect(screen.queryByText(MESSAGE_TITLE)).toBeNull();
      expect(rows()).toHaveLength(15);
    });

    it('does not revive the message when the sort goes back to the same request (A, B, A)', async () => {
      await stuckRetry();
      const sort = screen.getByLabelText('Sort by');
      fireEvent.change(sort, { target: { value: 'symbol.desc' } });
      await screen.findByRole('heading', { level: 2 });
      fireEvent.change(sort, { target: { value: '' } });
      await waitFor(() => expect(screen.queryByText(MESSAGE_TITLE)).toBeNull());
      await waitFor(() => expect(skeletonRows().length + rows().length).toBeGreaterThan(0));
      expect(screen.queryByText(MESSAGE_TITLE)).toBeNull();
    });

    it('does not keep the message over the results of a sort change', async () => {
      await stuckRetry();
      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.desc' } });
      await screen.findByRole('heading', { level: 2 });
      expect(screen.queryByText(MESSAGE_TITLE)).toBeNull();
      expect(rows()).toHaveLength(15);
    });
  });

  it('shows the message in place of the results when a refinement fails', async () => {
    const api = fakeApi();
    renderApp(api);
    await search('a');
    const base = api.searchIndex.getMockImplementation()!;
    api.searchIndex.mockImplementation(async (body, signal) => {
      if (body.include?.includes('documents')) throw new ApiError(500, 'boom');
      return base(body, signal);
    });
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'symbol.desc' } });

    await screen.findByText(MESSAGE_TITLE);
    expect(rows()).toHaveLength(0);
    expect(screen.getByLabelText('Sort by')).toBeTruthy();
  });
});

describe('retry layers', () => {
  it('one outage is retried only by the API client: apiRetries + 1 attempts and a single major_failure', async () => {
    const api = fakeApi();
    const base = api.searchIndex.getMockImplementation()!;
    let attempts = 0;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const path = url.replace('http://x', '');
      const body = init?.body ? JSON.parse(init.body as string) : {};
      if (path === '/search/index') {
        if (body.include?.includes('documents')) {
          attempts++;
          return new Response('{}', { status: 503 });
        }
        return Response.json(await base(body));
      }
      if (path === '/version') return Response.json({ indexed_at: fake.indexedAt });
      if (path.startsWith('/popular')) return Response.json(await api.popular(1));
      return Response.json([]);
    });
    const report = vi.fn();
    const real = createApiClient('http://x', { report, retries: config.apiRetries, retryBaseMs: 1, timeoutMs: 1000 });
    renderApp(real as unknown as FakeApi, { report });
    fireEvent.change(screen.getByLabelText('Search shares and ETFs'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText(MESSAGE_TITLE);
    expect(attempts).toBe(config.apiRetries + 1);
    expect(report.mock.calls.filter(([event]) => event === 'major_failure')).toHaveLength(1);
    expect(report.mock.calls.filter(([event]) => event === 'api_call_failed')).toHaveLength(0);
    expect(removedEvents(report)).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
