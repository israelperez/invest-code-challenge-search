import { describe, expect, it } from 'vitest';
import { config } from './config';

describe('config', () => {
  it('points at the local API by default', () => {
    expect(config.apiBaseUrl).toBe('http://localhost:8787');
  });

  it('asks for 15 documents and a bounded id window per batch', () => {
    expect(config.documentLimit).toBe(15);
    expect(config.idLimit).toBeGreaterThanOrEqual(1);
    expect(config.idLimit).toBeLessThanOrEqual(1000);
  });

  it('checks the version every 60 seconds of staleness', () => {
    expect(config.versionStaleTimeMs).toBe(60_000);
  });

  it('keeps search results fresh forever until indexed_at changes', () => {
    expect(config.searchStaleTimeMs).toBe(Infinity);
  });

  it('has a positive number of skeleton rows', () => {
    expect(config.skeletonRows).toBeGreaterThan(0);
  });

  it('suggests from 3 characters after a 200ms pause', () => {
    expect(config.suggestionMinChars).toBe(3);
    expect(config.suggestionDebounceMs).toBe(200);
  });

  it('has only sane values', () => {
    for (const value of Object.values(config)) {
      expect(value).not.toBeUndefined();
      if (typeof value === 'number') expect(value).toBeGreaterThan(0);
    }
  });
});
