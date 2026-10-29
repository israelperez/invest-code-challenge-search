import { config } from '../config';

export const STORAGE_KEY = 'instrument-search.settings';

// The demo settings: whole numbers within these bounds, on/off toggles, and two strings.
// Not editable, on purpose: settingsEnabled (turning it off would hide the panel needed to turn it back on) and
// searchStaleTimeMs (Infinity is deliberate because indexed_at invalidates instead, and a number field can't hold Infinity).
// Key order matters: documentLimit and popularMax come first because orphanSize and the popular pills are bounded by them.
export const NUMBER_FIELDS = {
  documentLimit: { label: 'Results per load', min: 1, max: 50 },
  popularMax: { label: 'Most popular pills', min: 1, max: 50 }, // the API's /popular limit is 1 to 50
  orphanSize: { label: 'Smallest last page', min: 0, max: 10 }, // also below documentLimit
  idLimit: { label: 'IDs per search request', min: 1, max: 1000 }, // the API's id_limit is 1 to 1000
  skeletonRows: { label: 'Result placeholder rows', min: 1, max: 10 },
  featuredIssuers: { label: 'Issuers shown before "Show all"', min: 1, max: 50 },
  countsDebounceMs: { label: 'Filter counts delay (ms)', min: 0, max: 2000 },
  versionStaleTimeMs: { label: 'Version check interval (ms)', min: 0, max: 600_000 },
  suggestionMinChars: { label: 'Suggestion minimum characters', min: 1, max: 10 },
  suggestionTermLimit: { label: 'Issuer suggestions shown', min: 1, max: 10 },
  suggestionDebounceMs: { label: 'Suggestion delay (ms)', min: 0, max: 2000 },
  suggestionSkeletonRows: { label: 'Suggestion placeholder rows', min: 1, max: 5 },
  popularMobile: { label: 'Popular pills on phones', min: 0, max: 50 }, // also at most popularMax
  popularTablet: { label: 'Popular pills on tablets', min: 0, max: 50 },
  popularDesktop: { label: 'Popular pills on desktops', min: 0, max: 50 },
  popularInPopup: { label: 'Popular searches in the search box', min: 0, max: 20 },
  recentSearchLimit: { label: 'Recent searches kept', min: 1, max: 20 },
  apiRetries: { label: 'API retries', min: 0, max: 10 },
  apiRetryBaseMs: { label: 'First retry wait (ms)', min: 0, max: 5000 },
  apiTimeoutMs: { label: 'API timeout (ms)', min: 500, max: 60_000 },
} as const;
export type NumberKey = keyof typeof NUMBER_FIELDS;

// The toggles; the tab places them.
export const BOOLEAN_KEYS = ['popularSearchOneLine', 'showRawData', 'recentSearches', 'insightsEnabled', 'dataProblemsEnabled', 'analytics'] as const;
export type BooleanKey = (typeof BOOLEAN_KEYS)[number];

// The strings: a URL, and the featured searches as a list (typed as comma-separated text).
export const STRING_FIELDS = {
  apiBaseUrl: { label: 'API address' },
  featuredSearches: { label: 'Featured searches' },
} as const;
export type StringKey = keyof typeof STRING_FIELDS;

// The three popular pill fields are one size each of config.popularShown.
const POPULAR_SIZE = { popularMobile: 'mobile', popularTablet: 'tablet', popularDesktop: 'desktop' } as const;
const isPopular = (key: NumberKey): key is keyof typeof POPULAR_SIZE => key in POPULAR_SIZE;
const read = (source: typeof config, key: NumberKey): number => (isPopular(key) ? source.popularShown[POPULAR_SIZE[key]] : source[key]);

// The value in force now (the default, or the override applied at startup).
export const effective = (key: NumberKey) => read(config, key);

// The upper bound given the values chosen for the keys it depends on: pills follow popularMax, orphanSize stays below documentLimit.
export const maxFor = (key: NumberKey, valueOf: (key: NumberKey) => number): number =>
  isPopular(key) ? Math.min(NUMBER_FIELDS[key].max, valueOf('popularMax')) : key === 'orphanSize' ? Math.min(NUMBER_FIELDS[key].max, valueOf('documentLimit') - 1) : NUMBER_FIELDS[key].max;

// Only what the presenter changed; anything absent keeps the config.ts default.
export type Overrides = Partial<Record<NumberKey, number>> & Partial<Record<BooleanKey, boolean>> & { apiBaseUrl?: string; featuredSearches?: string[] };

export const isValidUrl = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\/\S+$/.test(value);
export const isValidList = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim() !== '');

type GetStorage = () => Storage;
const local: GetStorage = () => localStorage;

// Unreadable, corrupt or out-of-range values are dropped one by one, so they fall back to the default.
export function loadOverrides(getStorage: GetStorage = local): Overrides {
  try {
    const stored: unknown = JSON.parse(getStorage().getItem(STORAGE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
    const found = stored as Record<string, unknown>;
    const overrides: Overrides = {};
    const valueOf = (key: NumberKey) => overrides[key] ?? effective(key);
    for (const key of Object.keys(NUMBER_FIELDS) as NumberKey[]) {
      const value = found[key];
      if (Number.isInteger(value) && (value as number) >= NUMBER_FIELDS[key].min && (value as number) <= maxFor(key, valueOf)) overrides[key] = value as number;
    }
    for (const key of BOOLEAN_KEYS) if (typeof found[key] === 'boolean') overrides[key] = found[key];
    if (isValidUrl(found.apiBaseUrl)) overrides.apiBaseUrl = found.apiBaseUrl;
    if (isValidList(found.featuredSearches)) overrides.featuredSearches = found.featuredSearches;
    return overrides;
  } catch {
    return {};
  }
}

// False when storage refuses the write, so the tab can say so instead of reloading into nothing.
export function saveOverrides(overrides: Overrides, getStorage: GetStorage = local): boolean {
  try {
    // Nothing differs from the defaults: no entry at all.
    if (Object.keys(overrides).length === 0) getStorage().removeItem(STORAGE_KEY);
    else getStorage().setItem(STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
}

// False when storage refuses, so the tab can say so instead of reloading with the overrides still in place.
export function resetOverrides(getStorage: GetStorage = local): boolean {
  try {
    getStorage().removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// config is `as const` for readers; startup is the one place allowed to change it. Popular sizes merge into popularShown one by one.
export function applyOverrides(overrides: Overrides) {
  const popularShown: Record<string, number> = { ...config.popularShown };
  for (const [key, value] of Object.entries(overrides)) {
    if (key in POPULAR_SIZE) popularShown[POPULAR_SIZE[key as keyof typeof POPULAR_SIZE]] = value as number;
    else Object.assign(config, { [key]: value });
  }
  Object.assign(config, { popularShown });
}

// Called once from main.tsx before anything reads config.
export const applySettings = () => applyOverrides(loadOverrides());

// The config.ts defaults, read before applySettings. Only values that differ from these are stored, so a later edit to a default still reaches untouched keys.
const defaults = { ...config, popularShown: { ...config.popularShown } };

// The list typed as text: comma-separated, trimmed, blanks dropped, upper-cased.
export const parseList = (text: string) => text.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);

// Typed numbers are rounded and clamped into range (pills to the chosen popularMax, orphanSize below the chosen documentLimit);
// blank or invalid ones fall back to the default. A value is stored only when it differs from the default.
export function overridesFromForm(values: Record<NumberKey, string>, flags: Record<BooleanKey, boolean>, texts: Record<StringKey, string>): Overrides {
  const overrides: Overrides = {};
  const chosen: Partial<Record<NumberKey, number>> = {};
  const valueOf = (key: NumberKey) => chosen[key] ?? read(defaults, key);
  for (const key of Object.keys(NUMBER_FIELDS) as NumberKey[]) {
    const typed = !values[key].trim() || !Number.isFinite(Number(values[key])) ? read(defaults, key) : Number(values[key]);
    const value = Math.min(maxFor(key, valueOf), Math.max(NUMBER_FIELDS[key].min, Math.round(typed)));
    chosen[key] = value;
    if (read(defaults, key) !== value) overrides[key] = value;
  }
  for (const key of BOOLEAN_KEYS) if (flags[key] !== defaults[key]) overrides[key] = flags[key];
  const url = texts.apiBaseUrl.trim();
  if (isValidUrl(url) && url !== defaults.apiBaseUrl) overrides.apiBaseUrl = url;
  const list = parseList(texts.featuredSearches);
  if (list.length > 0 && list.join() !== defaults.featuredSearches.join()) overrides.featuredSearches = list;
  return overrides;
}
