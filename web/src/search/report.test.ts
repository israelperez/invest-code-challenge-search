import { afterEach, describe, expect, it, vi } from 'vitest';
import { consoleReport } from './report';

afterEach(() => vi.restoreAllMocks());

describe('consoleReport', () => {
  it('prints the message and detail, then the entries as a final argument', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleReport('logo_failed', { level: 'warn', message: 'Logo failed', detail: 'GRV:AU', entries: ['GRV (https://example.test/GRV_AU.png)'] });
    expect(warn).toHaveBeenCalledWith('Logo failed', 'GRV:AU', ['GRV (https://example.test/GRV_AU.png)']);
  });

  it('prints exactly as before without entries', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleReport('load_more_failed', { level: 'error', message: 'failed', detail: 'boom' });
    consoleReport('restart_failed', { level: 'error', message: 'failed too', entries: [] });
    expect(error).toHaveBeenNthCalledWith(1, 'failed', 'boom');
    expect(error).toHaveBeenNthCalledWith(2, 'failed too');
  });
});
