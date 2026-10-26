import { describe, expect, it } from 'vitest';
import { kindLabel } from './kind-label';

describe('kindLabel', () => {
  it('names each type for the filter and chip (plural)', () => {
    expect(kindLabel('equity', true)).toBe('Shares (equities)');
    expect(kindLabel('etf', true)).toBe('ETFs');
  });

  it('names each type for a result row (singular)', () => {
    expect(kindLabel('equity')).toBe('Share (equity)');
    expect(kindLabel('etf')).toBe('ETF');
  });

  it('falls back to the raw value for an unknown kind', () => {
    expect(kindLabel('reit', true)).toBe('reit');
    expect(kindLabel('reit')).toBe('reit');
  });
});
