import { describe, expect, it } from 'vitest';
import { issuerLabel } from '../format/issuer-label';
import { appliedCount, applyLabel, bucketLabel, filterSections, UNIT_BUCKET_ROWS, type Facets } from './filter-options';

const BUCKETS = [
  '0,100000000',
  '100000000,500000000',
  '500000000,1000000000',
  '1000000000,5000000000',
  '5000000000,1000000000000',
];

const facets: Facets = {
  kind: [
    { value: 'equity', count: 0 },
    { value: 'etf', count: 12 },
  ],
  issuer: [],
  is_betashares: [
    { value: 'true', count: 4 },
    { value: 'false', count: 8 },
  ],
  is_flagship_fund: [
    { value: 'true', count: 0 },
    { value: 'false', count: 12 },
  ],
  is_auto_invest_included: [
    { value: 'true', count: 2 },
    { value: 'false', count: 10 },
  ],
  is_portfolio_excluded: [
    { value: 'true', count: 3 },
    { value: 'false', count: 9 },
  ],
  units_circulating: BUCKETS.map((value, i) => ({ value, count: i })),
};

const section = (id: string, f = facets, filters = {}) => filterSections(f, filters).find((s) => s.id === id)!;
const summary = (id: string, filters = {}) =>
  section(id, facets, filters).options.map(({ label, count, disabled, selected }) => ({ label, count, disabled, selected }));

describe('filterSections', () => {
  it('lists the sections in order', () => {
    expect(filterSections(facets, {}).map((s) => s.legend)).toEqual([
      'Type',
      'Issuer',
      'Betashares funds only',
      'Flagship funds',
      'Available for Auto Invest',
      'Portfolio eligible only',
      'Shares issued (stocks only)',
    ]);
  });

  it('labels kinds, disabling zero counts', () => {
    expect(summary('kind')).toEqual([
      { label: 'ETFs', count: 12, disabled: false, selected: false },
      { label: 'Stocks', count: 0, disabled: true, selected: false },
    ]);
  });

  it('keeps a selected zero-count option enabled', () => {
    expect(summary('kind', { kind: ['equity'] })[1]).toMatchObject({ disabled: false, selected: true });
  });

  it('shows an unknown kind as its raw value', () => {
    const odd = { ...facets, kind: [...facets.kind, { value: 'reit', count: 1 }] };
    expect(section('kind', odd).options.map((o) => o.label)).toEqual(['ETFs', 'Stocks', 'reit']);
  });

  it('reads the true count for flags and the false count for portfolio eligible', () => {
    expect(summary('is_betashares')).toEqual([{ label: 'Betashares funds only', count: 4, disabled: false, selected: false }]);
    expect(summary('is_flagship_fund')[0]).toMatchObject({ count: 0, disabled: true });
    expect(summary('is_portfolio_excluded', { is_portfolio_excluded: false })).toEqual([
      { label: 'Portfolio eligible only', count: 9, disabled: false, selected: true },
    ]);
  });

  it('offers Any plus one radio per bucket, with the selected one marked', () => {
    const filters = { units_circulating: { min: '100000000', max: '500000000' } };
    expect(summary('units_circulating', filters).map((o) => [o.label, o.selected])).toEqual([
      ['Any', false],
      ['Under 100 million', false],
      ['100 to 500 million', true],
      ['500 million to 1 billion', false],
      ['1 to 5 billion', false],
      ['Over 5 billion', false],
    ]);
    expect(summary('units_circulating')[0].selected).toBe(true);
  });

  it('computes the filters after toggling each option', () => {
    const kinds = section('kind', facets, { kind: ['etf'] }).options;
    expect(kinds[0].next).toEqual({});
    expect(kinds[1].next).toEqual({ kind: ['etf', 'equity'] });
    expect(section('is_betashares').options[0].next).toEqual({ is_betashares: true });
    expect(section('is_portfolio_excluded').options[0].next).toEqual({ is_portfolio_excluded: false });
    const units = section('units_circulating', facets, { is_betashares: true, units_circulating: { min: '0', max: '1' } }).options;
    expect(units[0].next).toEqual({ is_betashares: true });
    expect(units[2].next).toEqual({ is_betashares: true, units_circulating: { min: '100000000', max: '500000000' } });
  });

  it('still lists the known options before any counts arrive', () => {
    const [kind, , , , , , units] = filterSections(undefined, {});
    expect(kind.options.map((o) => [o.label, o.count, o.disabled])).toEqual([
      ['ETFs', undefined, false],
      ['Stocks', undefined, false],
    ]);
    // Stand-in rows keep the section the same height as the real one.
    expect(units.options).toHaveLength(1 + UNIT_BUCKET_ROWS);
    expect(units.options.slice(1).every((o) => o.placeholder && o.disabled)).toBe(true);
    expect(units.options).toHaveLength(section('units_circulating').options.length);
  });
});

describe('bucketLabel', () => {
  it('labels the five real edges', () => {
    expect(BUCKETS.map((b, i) => bucketLabel(b, i, BUCKETS.length))).toEqual([
      'Under 100 million',
      '100 to 500 million',
      '500 million to 1 billion',
      '1 to 5 billion',
      'Over 5 billion',
    ]);
  });
});

describe('applyLabel', () => {
  it.each([
    [0, 'No matching results'],
    [1, 'Show 1 result'],
    [31, 'Show 31 results'],
    [1240, 'Show 1,240 results'],
  ])('%i gives %s', (count, text) => {
    expect(applyLabel(count)).toBe(text);
  });
});

describe('issuer section', () => {
  // Ten issuers: counts 10..1, with a tie at the bottom and a colliding pair.
  const slugs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i ', 'investors mutual', 'investors_mutual'];
  const counts = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const issuerFacets = (over: Record<string, number> = {}): Facets => ({
    ...facets,
    issuer: slugs.map((value, i) => ({ value, count: over[value] ?? counts[i] })),
  });
  const issuers = (f: Facets | undefined, filters = {}, known = f) => filterSections(f, filters, known).find((s) => s.id === 'issuer')!;

  it('sits right after Type and uses checkboxes', () => {
    expect(issuers(issuerFacets())).toMatchObject({ legend: 'Issuer', control: 'checkbox' });
  });

  it('keeps the slug as the id, trailing whitespace and look-alikes included, ordered by label', () => {
    const { options } = issuers(issuerFacets());
    expect(options.map((o) => o.id)).toEqual(slugs.slice().sort((x, y) => issuerLabel(x).localeCompare(issuerLabel(y)) || x.localeCompare(y)));
    expect(options.map((o) => o.id)).toContain('i ');
    expect(options.filter((o) => o.label === 'Investors Mutual')).toHaveLength(2);
  });

  it('features the top 8 by count, then label, then slug', () => {
    expect(issuers(issuerFacets()).featured).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    // Ties at 3 between h and i: label order picks h.
    expect(issuers(issuerFacets({ i: 3 })).featured).toContain('h');
    expect(issuers(issuerFacets({ i: 3 })).featured).not.toContain('i ');
    expect(issuers(issuerFacets({ 'i ': 3, 'investors mutual': 3 })).featured?.slice(-1)).toEqual(['h']);
  });

  it('adds a selected issuer outside the top 8 so it stays removable', () => {
    expect(issuers(issuerFacets(), { issuer: ['investors_mutual'] }).featured).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'investors_mutual']);
  });

  it('ranks by the known facets, so rows stay while counts reload', () => {
    const section = issuers(undefined, {}, issuerFacets());
    expect(section.featured).toHaveLength(8);
    expect(section.options.every((o) => o.count === undefined)).toBe(true);
  });

  it('counts, disables and toggles like Type', () => {
    const f = issuerFacets({ b: 0 });
    const { options } = issuers(f, { issuer: ['c'] });
    const get = (id: string) => options.find((o) => o.id === id)!;
    expect(get('b')).toMatchObject({ count: 0, disabled: true, selected: false });
    expect(get('c')).toMatchObject({ selected: true, disabled: false, next: {} });
    expect(get('a').next).toEqual({ issuer: ['c', 'a'] });
    expect(issuers(issuerFacets({ c: 0 }), { issuer: ['c'] }).options.find((o) => o.id === 'c')).toMatchObject({ disabled: false, selected: true });
  });

  it('shows stand-in rows before any counts arrive', () => {
    const section = issuers(undefined, {});
    expect(section.options).toHaveLength(8);
    expect(section.options.every((o) => o.placeholder && o.disabled)).toBe(true);
    expect(section.featured).toEqual(section.options.map((o) => o.id));
  });
});

describe('appliedCount', () => {
  it('counts issuers, kinds, flags and the units bucket', () => {
    expect(appliedCount({ issuer: ['a', 'b'], kind: ['etf'], is_betashares: true, units_circulating: { min: '0', max: '1' } })).toBe(5);
  });
});
