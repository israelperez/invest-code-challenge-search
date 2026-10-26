import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from './analytics';

afterEach(() => vi.restoreAllMocks());

describe('console analytics', () => {
  it('prints a product event at info level: styled prefix, name, then data', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    createAnalytics({ enabled: true }).track('search_submitted', { term: 'A200', source: 'typed' });
    expect(info).toHaveBeenCalledWith('%c[analytics]', expect.any(String), 'search_submitted', { term: 'A200', source: 'typed' });
  });

  it('prints a problem at its own level: same prefix, event name, message, then detail', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { report } = createAnalytics({ enabled: true });
    report('batch_ids_missing', { level: 'warn', message: 'skipped:', detail: ['X:AU'] });
    report('snapshot_stale', { level: 'warn', message: 'stale' });
    report('load_more_failed', { level: 'error', message: 'failed', detail: 'boom' });
    expect(warn).toHaveBeenNthCalledWith(1, '%c[analytics]', expect.any(String), 'batch_ids_missing', 'skipped:', ['X:AU']);
    expect(warn).toHaveBeenNthCalledWith(2, '%c[analytics]', expect.any(String), 'snapshot_stale', 'stale');
    expect(error).toHaveBeenCalledWith('%c[analytics]', expect.any(String), 'load_more_failed', 'failed', 'boom');
  });

  it('with the flag off drops product events but still prints problems', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { track, report } = createAnalytics({ enabled: false });
    track('search_zero_results', { term: 'zzz', filtered: false });
    report('first_batch_failed', { level: 'error', message: 'failed' });
    expect(info).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
