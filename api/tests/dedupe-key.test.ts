import { describe, expect, it } from 'vitest';

import { dedupeKey, executableSpelling } from '../src/search-log/dedupe-key';

describe('dedupeKey', () => {
  it.each([
    ['etf', 'etf'],
    ['  ETF  ', 'etf'],
    ['Vanguard the ETF', 'etf vanguard'],
    ['asx for the etf of gold and silver', 'etf gold silver'],
    ['gold gold etf', 'etf gold'],
  ])('normalises %j to %j', (term, key) => {
    expect(dedupeKey(term)).toBe(key);
  });

  it('gives case and word-order variants one key', () => {
    expect(dedupeKey('Gold ETF')).toBe(dedupeKey('etf GOLD'));
  });

  it('treats uppercase OR as an operator and joins sorted clauses', () => {
    expect(dedupeKey('silver OR gold')).toBe('gold OR silver');
    expect(dedupeKey('silver OR gold')).toBe(dedupeKey('gold OR silver'));
  });

  it('treats lowercase or as an ordinary word', () => {
    expect(dedupeKey('gold or silver')).toBe('gold or silver');
    expect(dedupeKey('gold or silver')).not.toBe(dedupeKey('gold OR silver'));
  });

  it('keeps differently grouped words apart', () => {
    expect(dedupeKey('gold silver OR bronze')).not.toBe(
      dedupeKey('gold OR silver bronze'),
    );
  });

  it('only treats a whole whitespace-delimited OR as an operator', () => {
    expect(dedupeKey('goldOR silver')).toBe('goldor silver');
  });

  it.each([['OR gold'], ['gold OR'], ['gold OR OR silver'], ['OR']])(
    'does not log malformed operators: %j',
    (term) => {
      expect(dedupeKey(term)).toBe('');
    },
  );

  it.each([[''], ['   '], ['the of and'], ['asx']])(
    'does not log blank or stop-word-only terms: %j',
    (term) => {
      expect(dedupeKey(term)).toBe('');
    },
  );

  it('drops a clause made only of stop words', () => {
    expect(dedupeKey('the OR gold')).toBe('gold');
  });
});

describe('executableSpelling', () => {
  it('trims, collapses whitespace and lowercases everything except OR', () => {
    expect(executableSpelling('  Gold   ETF  OR   Silver ')).toBe(
      'gold etf OR silver',
    );
    expect(executableSpelling('gold or silver')).toBe('gold or silver');
  });
});
