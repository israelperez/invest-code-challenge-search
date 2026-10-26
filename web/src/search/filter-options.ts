import type { FacetEntry } from '../api/types';
import { config } from '../config';
import { issuerLabel } from '../format/issuer-label';
import { kindLabel } from '../format/kind-label';
import type { Filters } from './build-search-request';

export type Facets = Record<string, FacetEntry[]>;

export type FilterOption = {
  id: string;
  label: string;
  // A stand-in row shown until the real options arrive.
  placeholder?: boolean;
  // Undefined until the counts arrive.
  count?: number;
  disabled: boolean;
  selected: boolean;
  // The filters after choosing this option, so components never build filters themselves.
  next: Filters;
};

export type FilterSection = {
  id: string;
  legend: string;
  control: 'checkbox' | 'radio';
  options: FilterOption[];
  // Option ids to show while the section is collapsed; every option otherwise.
  featured?: string[];
};

// Matches the API's configured units_circulating buckets; the real rows replace these once the counts arrive.
export const UNIT_BUCKET_ROWS = 5;

// Always listed in the Type section, in this order.
const KNOWN_KINDS = ['etf', 'equity'];

// Shown before Type; portfolio eligibility is shown last.
const BETASHARES_FLAGS = [
  { key: 'is_betashares', label: 'Betashares funds only', value: true },
  { key: 'is_flagship_fund', label: 'Flagship funds', value: true },
  { key: 'is_auto_invest_included', label: 'Available for Auto Invest', value: true },
] as const;
const PORTFOLIO_FLAG = { key: 'is_portfolio_excluded', label: 'Portfolio eligible only', value: false } as const;
const FLAGS = [...BETASHARES_FLAGS, PORTFOLIO_FLAG] as const;

const countOf = (facets: Facets | undefined, key: string, value: string) =>
  facets?.[key]?.find((entry) => entry.value === value)?.count;

const without = (filters: Filters, key: keyof Filters): Filters => {
  const next = { ...filters };
  delete next[key];
  return next;
};

const option = (id: string, label: string, count: number | undefined, selected: boolean, next: Filters): FilterOption => ({
  id,
  label,
  count,
  // A selected option stays enabled so it can always be removed.
  disabled: count === 0 && !selected,
  selected,
  next,
});

const byLabel = (a: string, b: string) => issuerLabel(a).localeCompare(issuerLabel(b)) || a.localeCompare(b);

const unit = (n: number) => (n >= 1e9 ? ([n / 1e9, 'billion'] as const) : ([n / 1e6, 'million'] as const));

// `value` is the API's "min,max" edge pair.
export function bucketLabel(value: string, index: number, total: number): string {
  const [min, max] = value.split(',').map(Number);
  if (index === 0) return `Under ${unit(max).join(' ')}`;
  if (index === total - 1) return `Over ${unit(min).join(' ')}`;
  const [a, aUnit] = unit(min);
  const [b, bUnit] = unit(max);
  return aUnit === bUnit ? `${a} to ${b} ${bUnit}` : `${a} ${aUnit} to ${b} ${bUnit}`;
}

// How many selections are applied: each kind, each issuer, each flag and the units bucket.
export const appliedCount = (filters: Filters) =>
  (filters.kind?.length ?? 0) + (filters.issuer?.length ?? 0) + FLAGS.filter(({ key, value }) => filters[key] === value).length + (filters.units_circulating ? 1 : 0);

export type AppliedChip = { id: string; label: string; next: Filters };

// One chip per applied value, in panel order; each `next` is the filters without just that value.
export function appliedChips(filters: Filters, known?: Facets): AppliedChip[] {
  const chosenKinds = filters.kind ?? [];
  const kinds = [...new Set([...KNOWN_KINDS, ...chosenKinds])].filter((k) => chosenKinds.includes(k));
  const chosenIssuers = filters.issuer ?? [];
  const drop = (key: 'kind' | 'issuer', value: string): Filters => {
    const list = (filters[key] ?? []).filter((v) => v !== value);
    return list.length ? { ...filters, [key]: list } : without(filters, key);
  };
  const buckets = (known?.units_circulating ?? []).map((e) => e.value);
  const { units_circulating: units } = filters;
  const bucket = units ? buckets.findIndex((value) => value === `${units.min},${units.max}`) : -1;
  const flagChips = (flags: readonly (typeof FLAGS)[number][]) =>
    flags.filter(({ key, value }) => filters[key] === value).map(({ key, label }) => ({ id: key, label, next: without(filters, key) }));
  return [
    ...flagChips(BETASHARES_FLAGS),
    ...kinds.map((kind) => ({ id: `kind:${kind}`, label: kindLabel(kind, true), next: drop('kind', kind) })),
    ...[...chosenIssuers].sort(byLabel).map((slug) => ({ id: `issuer:${slug}`, label: issuerLabel(slug), next: drop('issuer', slug) })),
    ...(units
      ? [
          {
            id: 'units_circulating',
            // shortcut: a bucket missing from `known` (counts not loaded yet) gets a generic label, fine as the next counts reply restores it.
            label: `Shares issued: ${bucket >= 0 ? bucketLabel(buckets[bucket], bucket, buckets.length) : 'selected range'}`,
            next: without(filters, 'units_circulating'),
          },
        ]
      : []),
    ...flagChips([PORTFOLIO_FLAG]),
  ];
}

export const applyLabel = (count: number) =>
  count === 0 ? 'No matching results' : `Show ${count.toLocaleString('en-AU')} ${count === 1 ? 'result' : 'results'}`;

// `known` may be older than `facets`; it only supplies the bucket rows, so they don't vanish while counts reload.
export function filterSections(facets: Facets | undefined, filters: Filters, known: Facets | undefined = facets): FilterSection[] {
  const kinds = [...new Set([...KNOWN_KINDS, ...(facets?.kind ?? []).map((e) => e.value)])];
  const chosen = filters.kind ?? [];
  const kindSection: FilterSection = {
    id: 'kind',
    legend: 'Type',
    control: 'checkbox',
    options: kinds.map((kind) => {
      const selected = chosen.includes(kind);
      const kindList = selected ? chosen.filter((k) => k !== kind) : [...chosen, kind];
      return option(kind, kindLabel(kind, true), countOf(facets, 'kind', kind), selected, kindList.length ? { ...filters, kind: kindList } : without(filters, 'kind'));
    }),
  };

  const issuerSlugs = (known?.issuer ?? []).map((e) => e.value);
  const chosenIssuers = filters.issuer ?? [];
  const issuerOptions = issuerSlugs.sort(byLabel).map((slug) => {
    const selected = chosenIssuers.includes(slug);
    const list = selected ? chosenIssuers.filter((s) => s !== slug) : [...chosenIssuers, slug];
    return option(slug, issuerLabel(slug), countOf(facets, 'issuer', slug), selected, list.length ? { ...filters, issuer: list } : without(filters, 'issuer'));
  });
  const topIssuers = [...(known?.issuer ?? [])]
    .sort((a, b) => b.count - a.count || byLabel(a.value, b.value))
    .slice(0, config.featuredIssuers)
    .map((e) => e.value);
  const featured = [...topIssuers, ...chosenIssuers.filter((slug) => issuerSlugs.includes(slug) && !topIssuers.includes(slug))];
  const issuerStandIns = Array.from({ length: config.featuredIssuers }, (_, i) => ({ ...option(`placeholder-${i}`, '', undefined, false, filters), placeholder: true, disabled: true }));
  const issuerSection: FilterSection = issuerSlugs.length
    ? { id: 'issuer', legend: 'Issuer', control: 'checkbox', options: issuerOptions, featured }
    : { id: 'issuer', legend: 'Issuer', control: 'checkbox', options: issuerStandIns, featured: issuerStandIns.map((o) => o.id) };

  const flagSection = ({ key, label, value }: (typeof FLAGS)[number]): FilterSection => {
    const selected = filters[key] === value;
    const next = selected ? without(filters, key) : { ...filters, [key]: value };
    return { id: key, legend: label, control: 'checkbox', options: [option(key, label, countOf(facets, key, String(value)), selected, next)] };
  };

  const buckets = (known?.units_circulating ?? []).map((e) => e.value);
  const current = filters.units_circulating;
  const any = option('any', 'Any', undefined, !current, without(filters, 'units_circulating'));
  const standIns = buckets.length
    ? []
    : Array.from({ length: UNIT_BUCKET_ROWS }, (_, i) => ({ ...option(`placeholder-${i}`, '', undefined, false, filters), placeholder: true, disabled: true }));
  const unitsSection: FilterSection = {
    id: 'units_circulating',
    legend: 'Shares issued (equities only)',
    control: 'radio',
    options: [
      any,
      ...standIns,
      ...buckets.map((value, i) => {
        const [min, max] = value.split(',');
        const selected = current?.min === min && current?.max === max;
        return option(value, bucketLabel(value, i, buckets.length), countOf(facets, 'units_circulating', value), selected, {
          ...filters,
          units_circulating: { min, max },
        });
      }),
    ],
  };

  return [...BETASHARES_FLAGS.map(flagSection), kindSection, issuerSection, unitsSection, flagSection(PORTFOLIO_FLAG)];
}
