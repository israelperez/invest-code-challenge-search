import { describe, expect, it } from 'vitest';
import { planHydration } from './hydration-planner';

const ids = Array.from({ length: 40 }, (_, i) => `ID${i}:AU`);
const plan = (overrides: Partial<Parameters<typeof planHydration>[0]> = {}) =>
  planHydration({ ids, consumed: 15, batchSize: 15, nextIdOffset: null, has: () => false, ...overrides });

describe('planHydration', () => {
  it('takes the next batch of IDs after those already consumed', () => {
    const result = plan();
    expect(result.batchIds).toEqual(ids.slice(15, 30));
    expect(result.needsNextWindow).toBe(false);
    expect(result.exhausted).toBe(false);
  });

  it('lists only the batch IDs the store lacks, in order', () => {
    const known = new Set([ids[16], ids[20]]);
    expect(plan({ has: (id) => known.has(id) }).missingIds).toEqual(
      ids.slice(15, 30).filter((id) => !known.has(id)),
    );
  });

  it('asks for nothing when every batch document is already stored', () => {
    expect(plan({ has: () => true }).missingIds).toEqual([]);
  });

  it('needs the next ID window when the loaded IDs run short of a full batch', () => {
    const result = plan({ consumed: 30, nextIdOffset: 40 });
    expect(result.batchIds).toEqual(ids.slice(30, 40));
    expect(result.needsNextWindow).toBe(true);
    expect(result.exhausted).toBe(false);
  });

  it('serves a short final batch when no further window exists', () => {
    const result = plan({ consumed: 30, nextIdOffset: null });
    expect(result.batchIds).toEqual(ids.slice(30, 40));
    expect(result.needsNextWindow).toBe(false);
    expect(result.exhausted).toBe(false);
  });

  it('needs the next window when every loaded ID is consumed', () => {
    const result = plan({ consumed: 40, nextIdOffset: 40 });
    expect(result.batchIds).toEqual([]);
    expect(result.needsNextWindow).toBe(true);
    expect(result.exhausted).toBe(false);
  });

  it('is exhausted when nothing is left and no window follows', () => {
    const result = plan({ consumed: 40, nextIdOffset: null });
    expect(result.batchIds).toEqual([]);
    expect(result.needsNextWindow).toBe(false);
    expect(result.exhausted).toBe(true);
  });
});
