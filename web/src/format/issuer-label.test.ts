import { describe, expect, it } from 'vitest';
import { issuerLabel, issuerLabels } from './issuer-label';

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

describe('issuerLabels', () => {
  it('hints the raw slug on every slug of a colliding label', () => {
    const labels = issuerLabels(['investors mutual', 'investors_mutual', 'betashares']);
    expect(labels.get('investors mutual')).toEqual({ label: 'Investors Mutual', hint: 'investors mutual' });
    expect(labels.get('investors_mutual')).toEqual({ label: 'Investors Mutual', hint: 'investors_mutual' });
    expect(labels.get('betashares')).toEqual({ label: 'Betashares' });
  });

  it('keeps the slug exactly as given, trailing whitespace included', () => {
    const labels = issuerLabels(['alphinity ', 'alphinity']);
    expect(labels.get('alphinity ')).toEqual({ label: 'Alphinity', hint: 'alphinity ' });
    expect(labels.size).toBe(2);
  });

  it('does not collide the brand pair', () => {
    const labels = issuerLabels(['etf_shares', 'etfshares']);
    expect(labels.get('etf_shares')).toEqual({ label: 'ETF Shares' });
    expect(labels.get('etfshares')).toEqual({ label: 'ETFS' });
  });
});
