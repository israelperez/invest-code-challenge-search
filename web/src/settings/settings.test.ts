import { afterEach, describe, expect, it } from 'vitest';
import { config, popularRequestLimit } from '../config';
import { applyOverrides, loadOverrides, overridesFromForm, resetOverrides, saveOverrides, STORAGE_KEY } from './settings';

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    storage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) } as Storage,
    data,
  };
};
const throwing = () => {
  throw new Error('storage blocked');
};
const original = { ...config };
afterEach(() => void Object.assign(config, original));

describe('loading overrides', () => {
  it('is empty when nothing is stored', () => {
    expect(loadOverrides(() => memory().storage)).toEqual({});
  });

  it('keeps valid values', () => {
    const { storage } = memory(JSON.stringify({ documentLimit: 25, suggestionMinChars: 2, showRawData: true, popularTablet: 4 }));
    expect(loadOverrides(() => storage)).toEqual({ documentLimit: 25, suggestionMinChars: 2, showRawData: true, popularTablet: 4 });
  });

  it('drops values that are out of range, fractional, or the wrong type, keeping the valid ones', () => {
    const { storage } = memory(
      JSON.stringify({ documentLimit: 0, suggestionTermLimit: 2.5, recentSearchLimit: '5', showRawData: 'yes', popularMobile: -1, suggestionMinChars: 4, unknown: 1 }),
    );
    expect(loadOverrides(() => storage)).toEqual({ suggestionMinChars: 4 });
  });

  it('accepts 0 popular pills but not more than popularMax, and a bad size falls back alone', () => {
    const stored = JSON.stringify({ popularMobile: config.popularMax + 1, popularTablet: 0, popularDesktop: 'many' });
    expect(loadOverrides(() => memory(stored).storage)).toEqual({ popularTablet: 0 });
  });

  it.each(['not json', '[1,2]', 'null', '"text"'])('falls back to defaults for corrupt storage %s', (stored) => {
    expect(loadOverrides(() => memory(stored).storage)).toEqual({});
  });

  it('survives localStorage throwing', () => {
    expect(loadOverrides(throwing)).toEqual({});
  });
});

describe('saving and resetting', () => {
  it('round-trips through storage', () => {
    const { storage } = memory();
    expect(saveOverrides({ documentLimit: 30, showRawData: true }, () => storage)).toBe(true);
    expect(loadOverrides(() => storage)).toEqual({ documentLimit: 30, showRawData: true });
  });

  it('reset clears the overrides', () => {
    const { storage, data } = memory(JSON.stringify({ documentLimit: 30 }));
    resetOverrides(() => storage);
    expect(data.has(STORAGE_KEY)).toBe(false);
    expect(loadOverrides(() => storage)).toEqual({});
  });

  it('survives localStorage throwing, saying whether the save worked', () => {
    expect(saveOverrides({ documentLimit: 30 }, throwing)).toBe(false);
    expect(() => resetOverrides(throwing)).not.toThrow();
  });
});

describe('applying overrides', () => {
  it('sets only the keys given', () => {
    applyOverrides({ documentLimit: 25, showRawData: true });
    expect(config.documentLimit).toBe(25);
    expect(config.showRawData).toBe(true);
    expect(config.suggestionMinChars).toBe(original.suggestionMinChars);
  });

  it('merges each popular size into popularShown, leaving the others', () => {
    applyOverrides({ popularTablet: 4 });
    expect(config.popularShown).toEqual({ ...original.popularShown, tablet: 4 });
  });

  it('derives the popular request limit after the overrides are applied', () => {
    expect(popularRequestLimit()).toBe(13);
    applyOverrides({ popularDesktop: 4 });
    expect(popularRequestLimit()).toBe(8);
  });
});

const blank = { documentLimit: '', suggestionMinChars: '', suggestionTermLimit: '', popularMobile: '', popularTablet: '', popularDesktop: '', recentSearchLimit: '' };
const off = { popularSearchOneLine: config.popularSearchOneLine, showRawData: false };

describe('storing only what differs from the defaults', () => {

  it('drops a key set back to its default, and keeps one that differs', () => {
    const form = { ...blank, documentLimit: String(original.documentLimit), suggestionMinChars: '5' };
    expect(overridesFromForm(form, off)).toEqual({ suggestionMinChars: 5 });
  });

  it('stores a popular size only when it differs from that size\'s default', () => {
    const form = { ...blank, popularMobile: String(original.popularShown.mobile), popularTablet: '4', popularDesktop: String(original.popularShown.desktop) };
    expect(overridesFromForm(form, { ...off, showRawData: true })).toEqual({ popularTablet: 4, showRawData: true });
    expect(overridesFromForm(blank, off)).toEqual({});
  });

  it('picks up a later change to one popular default for the untouched sizes', () => {
    Object.assign(config, { popularShown: { ...original.popularShown, desktop: 10 } });
    applyOverrides({ popularMobile: 3 });
    expect(config.popularShown).toEqual({ mobile: 3, tablet: original.popularShown.tablet, desktop: 10 });
  });

  it('leaves no stored entry when nothing differs', () => {
    const { storage, data } = memory(JSON.stringify({ documentLimit: 30 }));
    saveOverrides({}, () => storage);
    expect(data.has(STORAGE_KEY)).toBe(false);
  });

  it('picks up a later change to a default for keys that are not stored', () => {
    Object.assign(config, { suggestionMinChars: 6 });
    applyOverrides({ documentLimit: 25 });
    expect(config.suggestionMinChars).toBe(6);
  });
});

describe('the debounce and the one-line toggle', () => {
  it('ignores a stored suggestionDebounceMs, applying nothing', () => {
    const { storage } = memory(JSON.stringify({ suggestionDebounceMs: 0, documentLimit: 25 }));
    const loaded = loadOverrides(() => storage);
    expect(loaded).toEqual({ documentLimit: 25 });
    applyOverrides(loaded);
    expect(config.suggestionDebounceMs).toBe(original.suggestionDebounceMs);
  });

  it('keeps a boolean popularSearchOneLine and drops a non-boolean one', () => {
    expect(loadOverrides(() => memory(JSON.stringify({ popularSearchOneLine: false })).storage)).toEqual({ popularSearchOneLine: false });
    expect(loadOverrides(() => memory(JSON.stringify({ popularSearchOneLine: 'no' })).storage)).toEqual({});
  });

  it('stores popularSearchOneLine only when it differs from the default', () => {
    const flipped = { ...off, popularSearchOneLine: !original.popularSearchOneLine };
    expect(overridesFromForm(blank, flipped)).toEqual({ popularSearchOneLine: !original.popularSearchOneLine });
    expect(overridesFromForm(blank, off)).toEqual({});
  });

  it('puts the applied override in force on config, which PopularPills reads at render', () => {
    applyOverrides({ popularSearchOneLine: false });
    expect(config.popularSearchOneLine).toBe(false);
  });
});
