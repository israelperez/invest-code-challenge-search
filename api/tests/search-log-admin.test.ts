import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { SearchLog } from '../src/search-log/search-log';
import { envConfig } from '../src/shared/configs/env.config';

const tmpFile = () =>
  join(mkdtempSync(join(tmpdir(), 'search-log-admin-')), 'log.json');
// Real instruments, so the seed gets real result counts; a temp log file, so nothing else is touched.
const start = (enableInsights = true, searchLogFile = tmpFile()) =>
  request(
    createApp({
      config: { ...envConfig, enableInsights, searchLogFile },
    }).callback(),
  );
const saved = (file: string) =>
  JSON.parse(readFileSync(file, 'utf-8')) as { keys: { key: string }[] };

describe('Reset popular searches endpoints', () => {
  it('Clear empties the log, so /popular has no terms', async () => {
    const api = start();
    expect((await api.get('/popular')).body.terms.length).toBeGreaterThan(0);

    expect((await api.delete('/search-log')).status).toBe(204);

    expect((await api.get('/popular')).body.terms).toEqual([]);
    expect((await api.get('/insights/zero-results')).body.groups).toEqual([]);
  });

  it('Restore demo data brings the seed back with real result counts', async () => {
    const api = start();
    await api.delete('/search-log');

    expect((await api.post('/search-log/restore-seed')).status).toBe(204);

    const { terms } = (await api.get('/popular?limit=50')).body;
    expect(terms.length).toBeGreaterThan(0);
    expect(terms[0]).toMatchObject({
      label: expect.any(String),
      clients: expect.any(Number),
    });
    expect(terms.some((t: { key: string }) => t.key === 'a200')).toBe(true);
  });

  it('Restore replaces a changed log rather than adding to it', async () => {
    const api = start();
    const before = (await api.get('/popular?limit=50')).body;
    await api.post('/search-log/restore-seed');
    expect((await api.get('/popular?limit=50')).body).toEqual(before);
  });

  it('persists both actions to the log file and survives a restart', async () => {
    const file = tmpFile();
    const api = start(true, file);
    await api.get('/popular');

    await api.delete('/search-log');
    expect(saved(file).keys).toEqual([]);
    expect((await start(true, file).get('/popular')).body.terms).toEqual([]);

    await api.post('/search-log/restore-seed');
    expect(saved(file).keys.length).toBeGreaterThan(0);
    expect(
      (await start(true, file).get('/popular')).body.terms.length,
    ).toBeGreaterThan(0);
  });

  it('does not exist when ENABLE_INSIGHTS is off', async () => {
    const api = start(false);
    expect((await api.delete('/search-log')).status).toBe(404);
    expect((await api.post('/search-log/restore-seed')).status).toBe(404);
  });

  it('is strict: unknown query parameters or body fields return 400', async () => {
    const api = start();
    expect((await api.delete('/search-log?force=1')).status).toBe(400);
    expect((await api.post('/search-log/restore-seed?x=1')).status).toBe(400);
    expect(
      (await api.post('/search-log/restore-seed').send({ x: 1 })).status,
    ).toBe(400);
    expect((await api.post('/search-log/restore-seed').send({})).status).toBe(
      204,
    );
  });

  it('answers 405 for other methods', async () => {
    expect((await start().get('/search-log')).status).toBe(405);
  });
});

describe('when the log file cannot be saved', () => {
  // A file where the log's folder should be, so every save fails.
  const blocked = () => {
    const parent = tmpFile();
    writeFileSync(parent, '');
    return join(parent, 'log.json');
  };

  it('both endpoints answer 500 instead of claiming success', async () => {
    const api = start(true, blocked());
    await api.get('/popular');

    expect((await api.delete('/search-log')).status).toBe(500);
    expect((await api.post('/search-log/restore-seed')).status).toBe(500);
  });

  it('an in-memory log has nothing to save, so both still answer 204', async () => {
    const searchLog = new SearchLog({ clock: () => 5, countFor: async () => 5 });
    const api = request(createApp({ searchLog, config: { ...envConfig, enableInsights: true } }).callback());

    expect((await api.delete('/search-log')).status).toBe(204);
    expect((await api.post('/search-log/restore-seed')).status).toBe(204);
  });
});

describe('SearchLog clear and replaceWith', () => {
  const make = () =>
    new SearchLog({
      clock: () => 5,
      countFor: async () => 5,
      config: {
        ipRate: { perMinute: 1e9, burst: 1e9 },
        clientRate: { perMinute: 1e9, burst: 1e9 },
      },
    });
  const submit = (log: SearchLog, submissionId: string) =>
    log.submit({ term: 'gold', submissionId, clientId: 'c', ip: 'ip' });

  it('clear empties the aggregates and forgets submission IDs', async () => {
    const log = make();
    expect(await submit(log, 'one')).toBe('recorded');
    log.clear();
    expect(log.aggregates()).toEqual([]);
    expect(await submit(log, 'one')).toBe('recorded');
  });

  it('replaceWith swaps the history for the entries', async () => {
    const log = make();
    await log.seed([{ term: 'old', clients: 1, searches: 1 }]);
    await log.replaceWith([{ term: 'new', clients: 2, searches: 3 }]);
    expect(log.aggregates().map((a) => a.key)).toEqual(['new']);
  });

  it('replaceWith keeps the old history when counting fails', async () => {
    let down = false;
    const log = new SearchLog({
      clock: () => 5,
      countFor: async () => (down ? Promise.reject(new Error('down')) : 5),
    });
    await log.seed([{ term: 'keep', clients: 1, searches: 1 }]);
    down = true;
    await expect(
      log.replaceWith([{ term: 'other', clients: 1, searches: 1 }]),
    ).rejects.toThrow('down');
    expect(log.aggregates().map((a) => a.key)).toEqual(['keep']);
  });
});
