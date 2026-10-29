import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from './analytics';

afterEach(() => vi.restoreAllMocks());

describe('console analytics', () => {
  it('prints a product event at info level: styled prefix, name, then data', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    createAnalytics().track('search_submitted', { term: 'A200', source: 'typed' });
    expect(info).toHaveBeenCalledWith('%c[analytics]', expect.any(String), 'search_submitted', { term: 'A200', source: 'typed' });
  });

  it('prints a problem at its own level: same prefix, event name, message, then detail', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { report } = createAnalytics();
    report('batch_ids_missing', { level: 'warn', message: 'skipped:', detail: ['X:AU'] });
    report('snapshot_stale', { level: 'warn', message: 'stale' });
    report('api_call_failed', { level: 'error', message: 'failed', detail: 'boom' });
    expect(warn).toHaveBeenNthCalledWith(1, '%c[analytics]', expect.any(String), 'batch_ids_missing', 'skipped:', ['X:AU']);
    expect(warn).toHaveBeenNthCalledWith(2, '%c[analytics]', expect.any(String), 'snapshot_stale', 'stale');
    expect(error).toHaveBeenCalledWith('%c[analytics]', expect.any(String), 'api_call_failed', 'failed', 'boom');
  });

  it('appends the entries as the final argument only when there are some', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { report } = createAnalytics();
    report('logo_failed', { level: 'warn', message: 'm', detail: 'GRV:AU', entries: ['GRV (https://example.test/a.png)'] });
    report('api_call_failed', { level: 'warn', message: 'm', entries: ['etf: boom'] });
    report('logo_failed', { level: 'warn', message: 'm', detail: 'GRV:AU', entries: [] });
    expect(warn).toHaveBeenNthCalledWith(1, '%c[analytics]', expect.any(String), 'logo_failed', 'm', 'GRV:AU', ['GRV (https://example.test/a.png)']);
    expect(warn).toHaveBeenNthCalledWith(2, '%c[analytics]', expect.any(String), 'api_call_failed', 'm', ['etf: boom']);
    expect(warn).toHaveBeenNthCalledWith(3, '%c[analytics]', expect.any(String), 'logo_failed', 'm', 'GRV:AU');
  });
});
