// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { problemsWrapper } from '../../tests/component/app-harness';
import { DataProblems } from './DataProblems';
import { createProblemCounter, DISTINCT_CAP } from './problem-counter';

afterEach(() => {
  cleanup();
});

const LABELS = [
  'Major failures (issues message shown)',
  'Batches that reported missing IDs',
  'Incomplete batch responses',
  'API calls that failed',
  'Logos that failed to load',
  'Instruments with no display name',
];
// The label and count line of each row (the summary when there is a disclosure).
const rowTexts = () => Array.from(screen.getAllByRole('list')[0].children).map((li) => (li.querySelector('summary') ?? li.firstElementChild)!.textContent);
const rowOf = (label: string) => screen.getByText(label).closest('li')!;

describe('Data problems section', () => {
  it('shows the heading, the demo banner and six rows in order, all at 0', () => {
    render(<DataProblems />, { wrapper: problemsWrapper() });
    expect(screen.getByRole('heading', { name: 'Data problems (this session, demo)' })).toBeTruthy();
    expect(screen.getByText('Demo data, development only. A real build would report these to an error-reporting service.')).toBeTruthy();
    expect(rowTexts()).toEqual(LABELS.map((l) => `${l}0`));
  });

  it('shows counts, ignoring events that are not listed', () => {
    const problems = createProblemCounter();
    (['batch_ids_missing', 'logo_failed', 'logo_failed', 'snapshot_stale', 'late_response_discarded'] as const).forEach((e) => problems.record(e));
    render(<DataProblems />, { wrapper: problemsWrapper({ problems }) });
    const texts = rowTexts();
    expect(texts).toHaveLength(6);
    expect(texts[1]).toBe('Batches that reported missing IDs1');
    expect(texts[4]).toBe('Logos that failed to load2');
  });

  it('updates live when a problem is recorded', () => {
    const problems = createProblemCounter();
    render(<DataProblems />, { wrapper: problemsWrapper({ problems }) });
    act(() => problems.record('major_failure'));
    expect(rowTexts()[0]).toBe('Major failures (issues message shown)1');
  });

  it('offers a disclosure only on rows with a count above 0', () => {
    const problems = createProblemCounter();
    problems.record('logo_failed', ['GRV (https://example.test/GRV_AU.png)']);
    render(<DataProblems />, { wrapper: problemsWrapper({ problems }) });
    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(within(rowOf('Logos that failed to load')).getByText('GRV (https://example.test/GRV_AU.png)')).toBeTruthy();
    expect(rowOf('API calls that failed').querySelector('details')).toBeNull();
  });

  it('keeps a row open while its count rises, and lists entries after it opens', () => {
    const problems = createProblemCounter();
    problems.record('batch_ids_missing', ['A:AU']);
    render(<DataProblems />, { wrapper: problemsWrapper({ problems }) });
    const details = rowOf('Batches that reported missing IDs').querySelector('details')!;
    fireEvent.click(details.querySelector('summary')!);
    expect(details.open).toBe(true);
    act(() => problems.record('batch_ids_missing', ['B:AU']));
    expect(rowOf('Batches that reported missing IDs').querySelector('details')).toBe(details);
    expect(details.open).toBe(true);
    expect(within(details).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A:AU', 'B:AU']);
  });

  it('says how many more there are beyond the ten kept', () => {
    const problems = createProblemCounter();
    problems.record('no_display_name', Array.from({ length: 13 }, (_, i) => `X${i}:AU`));
    render(<DataProblems />, { wrapper: problemsWrapper({ problems }) });
    const row = rowOf('Instruments with no display name');
    expect(within(row).getAllByRole('listitem').filter((li) => /^X\d+:AU$/.test(li.textContent!))).toHaveLength(10);
    expect(within(row).getByText('and 3 more')).toBeTruthy();
  });

  it('words the remainder as a lower bound once the distinct cap is reached', () => {
    const problems = createProblemCounter();
    problems.record('no_display_name', Array.from({ length: DISTINCT_CAP + 20 }, (_, i) => `X${i}:AU`));
    render(<DataProblems />, { wrapper: problemsWrapper({ problems }) });
    expect(within(rowOf('Instruments with no display name')).getByText(`and ${DISTINCT_CAP - 10}+ more`)).toBeTruthy();
  });

  it('passes axe with a disclosure open', async () => {
    const problems = createProblemCounter();
    problems.record('logo_failed', ['GRV (https://example.test/GRV_AU.png)']);
    render(<DataProblems />, { wrapper: problemsWrapper({ problems }) });
    fireEvent.click(rowOf('Logos that failed to load').querySelector('summary')!);
    expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });
});
