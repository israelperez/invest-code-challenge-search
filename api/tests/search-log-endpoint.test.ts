import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import { InstrumentsRepository } from '../src/index';
import { SearchLog } from '../src/search-log/search-log';
import { SearchLogConfig } from '../src/search-log/search-log.config';

const BIG = { perMinute: 1e9, burst: 1e9 };
const repository: InstrumentsRepository = {
  getAll: () => Promise.resolve([]),
  getIndexedAt: () => Promise.resolve(1),
};

function setup(config: Partial<SearchLogConfig> = {}) {
  const searchLog = new SearchLog({
    clock: () => 0,
    countFor: () => Promise.resolve(3),
    config: { ipRate: BIG, clientRate: BIG, ...config },
  });
  const api = request(createApp({ repository, searchLog }).callback());
  const send = (
    body: unknown = { term: 'gold', submission_id: crypto.randomUUID() },
    clientId: string | null = crypto.randomUUID(),
  ) => {
    const req = api.post('/searches');
    if (clientId !== null) {
      req.set('X-Client-Id', clientId);
    }
    return req.send(body as object);
  };
  return { api, searchLog, send };
}

afterEach(() => vi.restoreAllMocks());

describe('POST /searches', () => {
  it('records a search and answers 202', async () => {
    const { searchLog, send } = setup();
    const res = await send();
    expect(res.status).toBe(202);
    expect(searchLog.aggregates()).toHaveLength(1);
  });

  it('answers 202 without recording when the dedupe key is empty', async () => {
    const { searchLog, send } = setup();
    const res = await send({
      term: 'the OR',
      submission_id: crypto.randomUUID(),
    });
    expect(res.status).toBe(202);
    expect(searchLog.aggregates()).toEqual([]);
  });

  it('answers 202 without recording when rate limited', async () => {
    const { searchLog, send } = setup({ ipRate: { perMinute: 1, burst: 1 } });
    expect((await send()).status).toBe(202);
    expect((await send()).status).toBe(202);
    expect(searchLog.aggregates()[0].total).toBe(1);
  });

  it('records a repeated submission_id once', async () => {
    const { searchLog, send } = setup();
    const body = { term: 'gold', submission_id: crypto.randomUUID() };
    await send(body);
    await send(body);
    expect(searchLog.aggregates()[0].total).toBe(1);
  });

  const id = crypto.randomUUID();
  it.each([
    ['an unknown field', { term: 'gold', submission_id: id, extra: 1 }],
    ['an empty term', { term: '', submission_id: id }],
    ['a term over 100 characters', { term: 'a'.repeat(101), submission_id: id }],
    ['a non-string term', { term: 5, submission_id: id }],
    ['a missing term', { submission_id: id }],
    ['a non-UUID submission_id', { term: 'gold', submission_id: 'abc' }],
    ['a missing submission_id', { term: 'gold' }],
    ['a non-object body', ['gold']],
  ])('rejects %s with 400', async (_name, body) => {
    const { searchLog, send } = setup();
    const res = await send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(expect.any(String));
    expect(searchLog.aggregates()).toEqual([]);
  });

  it('accepts a term of exactly 100 characters', async () => {
    const { send } = setup();
    const res = await send({
      term: 'a'.repeat(100),
      submission_id: crypto.randomUUID(),
    });
    expect(res.status).toBe(202);
  });

  it.each([[null], ['not-a-uuid']])(
    'rejects X-Client-Id %j with 400',
    async (clientId) => {
      const { searchLog, send } = setup();
      const res = await send(undefined, clientId);
      expect(res.status).toBe(400);
      expect(searchLog.aggregates()).toEqual([]);
    },
  );

  it('allows X-Client-Id in a CORS preflight', async () => {
    const { api } = setup();
    const res = await api
      .options('/searches')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'x-client-id,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toMatch(
      /x-client-id/i,
    );
  });

  it('writes dev logs for rejects, rate-limit drops and evictions without the raw term', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const { send } = setup({ ipRate: { perMinute: 1, burst: 2 }, maxKeys: 1 });
    const secret = 'Secretterm';
    await send({ term: secret, submission_id: 'bad' }); // reject
    await send({ term: secret, submission_id: crypto.randomUUID() });
    await send({ term: 'other', submission_id: crypto.randomUUID() }); // evicts
    await send({ term: secret, submission_id: crypto.randomUUID() }); // rate limited

    const output = spies
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.join(' '))
      .join('\n');
    expect(output).toContain('search-log.rejected');
    expect(output).toContain('search-log.rate-limited');
    expect(output).toContain('search-log.evicted');
    expect(output.toLowerCase()).not.toContain('secretterm');
  });
});
