import type { FacetEntry } from '../api/types';
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

export type FilterSection = { id: string; legend: string; control: 'checkbox' | 'radio'; options: FilterOption[] };

// Matches the API's configured units_circulating buckets; the real rows replace these once the counts arrive.
export const UNIT_BUCKET_ROWS = 5;

const KIND_LABELS: Record<string, string> = { etf: 'ETFs', equity: 'Stocks' };

const FLAGS = [
  { key: 'is_betashares', label: 'Betashares funds only', value: true },
  { key: 'is_flagship_fund', label: 'Flagship funds', value: true },
  { key: 'is_auto_invest_included', label: 'Available for Auto Invest', value: true },
  { key: 'is_portfolio_excluded', label: 'Portfolio eligible only', value: false },
] as const;

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

export const applyLabel = (count: number) =>
  count === 0 ? 'No matching results' : `Show ${count.toLocaleString('en-AU')} ${count === 1 ? 'result' : 'results'}`;

// `known` may be older than `facets`; it only supplies the bucket rows, so they don't vanish while counts reload.
export function filterSections(facets: Facets | undefined, filters: Filters, known: Facets | undefined = facets): FilterSection[] {
  const kinds = [...new Set([...Object.keys(KIND_LABELS), ...(facets?.kind ?? []).map((e) => e.value)])];
  const chosen = filters.kind ?? [];
  const kindSection: FilterSection = {
    id: 'kind',
    legend: 'Type',
    control: 'checkbox',
    options: kinds.map((kind) => {
      const selected = chosen.includes(kind);
      const kindList = selected ? chosen.filter((k) => k !== kind) : [...chosen, kind];
      return option(kind, KIND_LABELS[kind] ?? kind, countOf(facets, 'kind', kind), selected, kindList.length ? { ...filters, kind: kindList } : without(filters, 'kind'));
    }),
  };

  const flagSections = FLAGS.map(({ key, label, value }): FilterSection => {
    const selected = filters[key] === value;
    const next = selected ? without(filters, key) : { ...filters, [key]: value };
    return { id: key, legend: label, control: 'checkbox', options: [option(key, label, countOf(facets, key, String(value)), selected, next)] };
  });

  const buckets = (known?.units_circulating ?? []).map((e) => e.value);
  const current = filters.units_circulating;
  const any = option('any', 'Any', undefined, !current, without(filters, 'units_circulating'));
  const standIns = buckets.length
    ? []
    : Array.from({ length: UNIT_BUCKET_ROWS }, (_, i) => ({ ...option(`placeholder-${i}`, '', undefined, false, filters), placeholder: true, disabled: true }));
  const unitsSection: FilterSection = {
    id: 'units_circulating',
    legend: 'Shares issued (stocks only)',
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

  return [kindSection, ...flagSections, unitsSection];
}
