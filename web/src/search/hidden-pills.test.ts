import { describe, expect, it } from 'vitest';
import { hiddenAfterFirstRow } from './hidden-pills';

describe('hiddenAfterFirstRow', () => {
  it('hides every pill that sits below the first one', () => {
    expect(hiddenAfterFirstRow([0, 0, 0, 44, 44, 88])).toEqual([false, false, false, true, true, true]);
  });

  it('hides nothing when everything fits on one row, or there are no pills', () => {
    expect(hiddenAfterFirstRow([12, 12, 12])).toEqual([false, false, false]);
    expect(hiddenAfterFirstRow([])).toEqual([]);
  });
});
