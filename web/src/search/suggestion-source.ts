import type { ApiClient } from '../api/client';
import type { SuggestedInstrument } from '../api/types';
import { issuerLabel } from '../format/issuer-label';

export type Suggestions = { terms: string[]; instruments: SuggestedInstrument[] };

const INSTRUMENT_LIMIT = 5;

// Suggestions ignore applied filters: issuers and instruments are looked up across the whole catalogue.
export function createSuggestionSource(
  api: Pick<ApiClient, 'facetIssuer' | 'suggestInstruments'>,
  options: { termLimit: number },
) {
  let labels: Promise<string[]> | undefined;
  // The issuer list is fetched once per source and shared, so it takes no caller's signal; a failure is
  // forgotten so the next keystroke retries.
  function issuerLabels() {
    labels ??= api
      .facetIssuer()
      .then((entries) => [...new Set(entries.map((e) => issuerLabel(e.value)))])
      .catch((error) => {
        labels = undefined;
        throw error;
      });
    return labels;
  }

  // The caller's signal only stops the caller waiting; it never cancels the shared fetch.
  function untilAborted<T>(promise: Promise<T>, signal: AbortSignal) {
    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      promise.then(resolve, reject);
    });
  }

  return {
    // Each lookup settles on its own: one failing still returns the other group, both failing rejects.
    async suggest(term: string, signal: AbortSignal): Promise<Suggestions> {
      const text = term.trim().toLowerCase().replace(/\s+/g, ' ');
      const [issuers, found] = await Promise.allSettled([
        untilAborted(issuerLabels(), signal),
        api.suggestInstruments({ search_text: term, size: INSTRUMENT_LIMIT }, signal),
      ]);
      signal.throwIfAborted();
      if (issuers.status === 'rejected' && found.status === 'rejected') throw issuers.reason;
      // The text may start at any word boundary of the label: "x", "global x" and "quay glo" all match.
      const startsAtWord = (label: string) => {
        const lower = label.toLowerCase();
        return [...lower.matchAll(/(^|\s)\S/g)].some((m) => lower.startsWith(text, m.index + m[1].length));
      };
      return {
        terms: issuers.status === 'fulfilled' ? issuers.value.filter(startsAtWord).slice(0, options.termLimit) : [],
        instruments: found.status === 'fulfilled' ? found.value.results : [],
      };
    },
  };
}
export type SuggestionSource = ReturnType<typeof createSuggestionSource>;
