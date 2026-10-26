import { describe, expect, it } from 'vitest';
import { issuerLabel } from './issuer-label';

describe('issuerLabel', () => {
  it.each([
    ['betashares', 'Betashares'],
    ['vaneck', 'VanEck'],
    ['globalx', 'Global X'],
    ['blackrock', 'BlackRock'],
    ['state_street', 'State Street'],
    ['barrow-hanley', 'Barrow Hanley'],
    ['investors mutual', 'Investors Mutual'],
    ['wilson_asset_management', 'Wilson Asset Management'],
  ])('%s -> %s', (slug, label) => {
    expect(issuerLabel(slug)).toBe(label);
  });

  it('ignores stray whitespace, as in the real data', () => {
    expect(issuerLabel('alphinity ')).toBe('Alphinity');
  });

  it('collapses repeated separators', () => {
    expect(issuerLabel('a__b - c')).toBe('A B C');
  });

  it('returns an empty string for a missing issuer', () => {
    expect(issuerLabel(null)).toBe('');
    expect(issuerLabel('')).toBe('');
  });
});
