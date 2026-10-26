import { config } from '../config';

export const STORAGE_KEY = 'instrument-search.settings';

// The demo settings: whole numbers within these bounds (popular pills are 0..popularMax), plus two on/off toggles.
export const NUMBER_FIELDS = {
  documentLimit: { label: 'Results per load', min: 1, max: 50 },
  suggestionMinChars: { label: 'Suggestion minimum characters', min: 1, max: 10 },
  suggestionTermLimit: { label: 'Issuer suggestions shown', min: 1, max: 10 },
  popularMobile: { label: 'Popular pills on phones', min: 0, max: config.popularMax },
  popularTablet: { label: 'Popular pills on tablets', min: 0, max: config.popularMax },
  popularDesktop: { label: 'Popular pills on desktops', min: 0, max: config.popularMax },
  recentSearchLimit: { label: 'Recent searches kept', min: 1, max: 20 },
} as const;
export type NumberKey = keyof typeof NUMBER_FIELDS;

// The toggles, in no particular order here; the tab places them.
export const BOOLEAN_KEYS = ['popularSearchOneLine', 'showRawData'] as const;
export type BooleanKey = (typeof BOOLEAN_KEYS)[number];

// The three popular pill fields are one size each of config.popularShown.
const POPULAR_SIZE = { popularMobile: 'mobile', popularTablet: 'tablet', popularDesktop: 'desktop' } as const;
const isPopular = (key: NumberKey): key is keyof typeof POPULAR_SIZE => key in POPULAR_SIZE;
const read = (source: typeof config, key: NumberKey): number => (isPopular(key) ? source.popularShown[POPULAR_SIZE[key]] : source[key]);

// The value in force now (the default, or the override applied at startup).
export const effective = (key: NumberKey) => read(config, key);

// Only what the presenter changed; anything absent keeps the config.ts default.
export type Overrides = Partial<Record<NumberKey, number>> & Partial<Record<BooleanKey, boolean>>;

export const isValidNumber = (key: NumberKey, value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= NUMBER_FIELDS[key].min && (value as number) <= NUMBER_FIELDS[key].max;

type GetStorage = () => Storage;
const local: GetStorage = () => localStorage;

// Unreadable, corrupt or out-of-range values are dropped one by one, so they fall back to the default.
export function loadOverrides(getStorage: GetStorage = local): Overrides {
  try {
    const stored: unknown = JSON.parse(getStorage().getItem(STORAGE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
    const found = stored as Record<string, unknown>;
    const overrides: Overrides = {};
    for (const key of Object.keys(NUMBER_FIELDS) as NumberKey[]) if (isValidNumber(key, found[key])) overrides[key] = found[key];
    for (const key of BOOLEAN_KEYS) if (typeof found[key] === 'boolean') overrides[key] = found[key];
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

// Typed numbers are rounded and clamped into range; blank or default values are not stored; a toggle is stored only when it differs from the default.
export function overridesFromForm(values: Record<NumberKey, string>, flags: Record<BooleanKey, boolean>): Overrides {
  const overrides: Overrides = {};
  for (const key of Object.keys(NUMBER_FIELDS) as NumberKey[]) {
    const typed = Number(values[key]);
    if (!values[key].trim() || !Number.isFinite(typed)) continue;
    const value = Math.min(NUMBER_FIELDS[key].max, Math.max(NUMBER_FIELDS[key].min, Math.round(typed)));
    if (read(defaults, key) !== value) overrides[key] = value;
  }
  for (const key of BOOLEAN_KEYS) if (flags[key] !== defaults[key]) overrides[key] = flags[key];
  return overrides;
}
