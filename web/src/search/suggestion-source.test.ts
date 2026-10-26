import { describe, expect, it, vi } from 'vitest';
import type { FacetEntry } from '../api/types';
import { createSuggestionSource } from './suggestion-source';

const issuers = ['globalx', 'balanced_capital', 'global_funds', 'x_global', 'glow', 'globe', 'glossy', 'gloss'];
const instrument = { symbol: 'A200', symbol_openfigi: 'A200:AU', display_name: 'Australia 200', logo: null };

function fakeClient() {
  return {
    facetIssuer: vi.fn(async (_signal?: AbortSignal): Promise<FacetEntry[]> => issuers.map((value) => ({ value, count: 1 }))),
    suggestInstruments: vi.fn(async (_body: { search_text: string; size: number }, _signal?: AbortSignal) => ({
      results: [instrument],
      count: 1,
      indexed_at: 1,
    })),
  };
}
const options = { termLimit: 5 };

describe('SuggestionSource', () => {
  it('matches terms by word prefix on the formatted issuer label', async () => {
    const source = createSuggestionSource(fakeClient(), options);
    const { terms } = await source.suggest('glo', new AbortController().signal);

    expect(terms).toContain('Global X');
    expect(terms).toContain('Global Funds');
    expect(terms).toContain('X Global');
    expect((await source.suggest('bal', new AbortController().signal)).terms).toEqual(['Balanced Capital']);
    expect((await source.suggest('lob', new AbortController().signal)).terms).toEqual([]);
  });

  it('caps terms at the term limit', async () => {
    const source = createSuggestionSource(fakeClient(), { termLimit: 2 });
    expect((await source.suggest('glo', new AbortController().signal)).terms).toHaveLength(2);
  });

  it('fetches the issuer list once and reuses it', async () => {
    const client = fakeClient();
    const source = createSuggestionSource(client, options);
    await source.suggest('glo', new AbortController().signal);
    await source.suggest('bal', new AbortController().signal);

    expect(client.facetIssuer).toHaveBeenCalledTimes(1);
  });

  it('starts both lookups before either resolves', async () => {
    const client = fakeClient();
    client.facetIssuer.mockImplementation(() => new Promise(() => {}));
    client.suggestInstruments.mockImplementation(() => new Promise(() => {}));
    void createSuggestionSource(client, options).suggest('glo', new AbortController().signal);

    expect(client.facetIssuer).toHaveBeenCalled();
    expect(client.suggestInstruments).toHaveBeenCalled();
  });

  it('asks for the top 5 instruments by the typed text and returns them', async () => {
    const client = fakeClient();
    const { instruments } = await createSuggestionSource(client, options).suggest('a200', new AbortController().signal);

    expect(client.suggestInstruments.mock.calls[0][0]).toEqual({ search_text: 'a200', size: 5 });
    expect(instruments).toEqual([instrument]);
  });

  it('passes the abort signal to the instruments request', async () => {
    const client = fakeClient();
    const { signal } = new AbortController();
    await createSuggestionSource(client, options).suggest('glo', signal);

    expect(client.suggestInstruments.mock.calls[0][1]).toBe(signal);
  });

  it('keeps the shared issuer fetch running when the first caller aborts, and reuses it', async () => {
    const client = fakeClient();
    let answer!: (entries: FacetEntry[]) => void;
    client.facetIssuer.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const source = createSuggestionSource(client, options);
    const first = new AbortController();
    const abandoned = source.suggest('glo', first.signal);
    first.abort();
    await expect(abandoned).rejects.toThrow();

    const pending = source.suggest('glo', new AbortController().signal);
    answer([{ value: 'globalx', count: 1 }]);

    expect((await pending).terms).toEqual(['Global X']);
    expect(client.facetIssuer).toHaveBeenCalledTimes(1);
    expect(client.facetIssuer.mock.calls[0][0]).toBeUndefined();
  });

  it('returns the instruments when the issuer lookup fails, and the terms when the instruments fail', async () => {
    const client = fakeClient();
    client.facetIssuer.mockRejectedValueOnce(new Error('issuers down'));
    const source = createSuggestionSource(client, options);
    expect(await source.suggest('glo', new AbortController().signal)).toEqual({ terms: [], instruments: [instrument] });

    client.suggestInstruments.mockRejectedValueOnce(new Error('search down'));
    const { terms, instruments } = await source.suggest('glo', new AbortController().signal);
    expect(terms).toContain('Global X');
    expect(instruments).toEqual([]);
  });

  it('rejects only when both lookups fail', async () => {
    const client = fakeClient();
    client.facetIssuer.mockRejectedValue(new Error('issuers down'));
    client.suggestInstruments.mockRejectedValue(new Error('search down'));

    await expect(createSuggestionSource(client, options).suggest('glo', new AbortController().signal)).rejects.toThrow();
  });

  it('lists look-alike issuer slugs once', async () => {
    const client = fakeClient();
    client.facetIssuer.mockResolvedValue(['investors mutual', 'investors_mutual'].map((value) => ({ value, count: 1 })));

    const { terms } = await createSuggestionSource(client, options).suggest('inv', new AbortController().signal);

    expect(terms).toEqual(['Investors Mutual']);
  });

  it('matches multi-word text from any word boundary of the label', async () => {
    const client = fakeClient();
    client.facetIssuer.mockResolvedValue(['globalx', 'quay_global', 'balanced_capital'].map((value) => ({ value, count: 1 })));
    const source = createSuggestionSource(client, options);
    const terms = async (text: string) => (await source.suggest(text, new AbortController().signal)).terms;

    expect(await terms('global x')).toEqual(['Global X']);
    expect(await terms('Global  X ')).toEqual(['Global X']);
    expect(await terms('quay glo')).toEqual(['Quay Global']);
    expect(await terms('glo')).toEqual(['Global X', 'Quay Global']);
    expect(await terms('bal')).toEqual(['Balanced Capital']);
    expect(await terms('lob')).toEqual([]);
  });

  it('retries the issuer list after a failure', async () => {
    const client = fakeClient();
    client.facetIssuer.mockRejectedValueOnce(new Error('down'));
    client.suggestInstruments.mockRejectedValueOnce(new Error('down'));
    const source = createSuggestionSource(client, options);

    await expect(source.suggest('glo', new AbortController().signal)).rejects.toThrow('down');
    expect((await source.suggest('glo', new AbortController().signal)).terms).toContain('Global X');
  });
});
