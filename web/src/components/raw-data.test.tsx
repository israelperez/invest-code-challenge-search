// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { ChakraProvider } from '@chakra-ui/react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doc, fake, fakeApi, renderApp, search } from '../../tests/component/app-harness';
import { config } from '../config';
import { system } from '../theme';
import { ResultRow } from './ResultRow';

const flags = config as { showRawData: boolean };
const noRegion = { rules: { region: { enabled: false } } };
const wrapper = ({ children }: { children: React.ReactNode }) => <ChakraProvider value={system}>{children}</ChakraProvider>;
const etf = () => ({ ...doc('FUND:AU'), display_name: 'Income Fund', issuer: 'investors_mutual' });
const share = () => ({ ...doc('ACME:AU'), display_name: 'Acme Ltd', kind: 'equity', issuer: 'investors mutual', units_circulating: '1500000' });

beforeEach(() => {
  fake.indexedAt = 1;
});
afterEach(() => {
  flags.showRawData = false;
  cleanup();
});

// The drawer (mobile layout) with the full issuer list shown.
async function openPanel() {
  renderApp(fakeApi());
  await search('a');
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  fireEvent.click(await screen.findByRole('button', { name: /^Show all/ }));
  await waitFor(() => expect((screen.getByRole('checkbox', { name: /ETFs/ }) as HTMLInputElement).disabled).toBe(false));
}

describe('Show raw data in a result row', () => {
  it('adds the raw issuer, type and instrument ID to an ETF row, and the raw units to a share row', () => {
    flags.showRawData = true;
    const { container } = render(<ResultRow instrument={etf()} />, { wrapper });
    for (const raw of ['investors_mutual', 'etf', 'FUND:AU']) expect(within(container).getByText(raw)).toBeTruthy();
    cleanup();
    render(<ResultRow instrument={share()} />, { wrapper });
    for (const raw of ['investors mutual', 'equity', '1500000', 'ACME:AU']) expect(screen.getByText(raw)).toBeTruthy();
  });

  it('shows only the labels when off, and the look-alike issuers share one', () => {
    const { container } = render(<ResultRow instrument={etf()} />, { wrapper });
    const first = container.textContent;
    expect(first).toContain('ETF · Investors Mutual');
    for (const raw of ['investors_mutual', 'etf', 'FUND:AU']) expect(first).not.toContain(raw);
    cleanup();
    render(<ResultRow instrument={share()} />, { wrapper });
    expect(document.body.textContent).toContain('Share (equity) · Investors Mutual · 1,500,000 units on issue');
    expect(document.body.textContent).not.toContain('1500000');
  });

  it('passes axe with raw data on', async () => {
    flags.showRawData = true;
    render(
      <ul>
        <ResultRow instrument={share()} />
      </ul>,
      { wrapper },
    );
    expect((await axe(document.body, noRegion)).violations).toEqual([]);
  });
});

describe('Show raw data in the filter panel', () => {
  it('shows the raw type, issuer and units range option, telling look-alike issuers apart', async () => {
    flags.showRawData = true;
    await openPanel();
    for (const raw of ['etf', 'equity', 'investors mutual', 'investors_mutual', '0,100000000', '5000000000,1000000000000']) {
      expect(screen.getAllByText(raw).length).toBeGreaterThan(0);
    }
    // The look-alikes carry the same label, so the raw value is the only difference.
    expect(screen.getAllByRole('checkbox', { name: /^Investors Mutual/ })).toHaveLength(2);
  });

  it('shows no raw values when off, and the look-alike issuers share one label', async () => {
    await openPanel();
    for (const raw of ['etf', 'equity', 'investors mutual', 'investors_mutual', '0,100000000']) expect(screen.queryByText(raw)).toBeNull();
    expect(screen.getAllByRole('checkbox', { name: 'Investors Mutual' })).toHaveLength(2);
  });

  it('passes axe with raw data on', async () => {
    flags.showRawData = true;
    await openPanel();
    expect((await axe(document.body, noRegion)).violations).toEqual([]);
  });
});

describe('Show raw data in the applied filter chips', () => {
  async function applyChips() {
    await openPanel();
    for (const box of [screen.getByRole('checkbox', { name: /ETFs/ }), screen.getAllByRole('checkbox', { name: /^Investors Mutual/ })[1]]) {
      fireEvent.click(box);
      await waitFor(() => expect((box as HTMLInputElement).checked).toBe(true));
    }
    fireEvent.click(await screen.findByRole('button', { name: /^Show \d/ }));
    return within(await screen.findByRole('list', { name: 'Applied filters' }));
  }

  it('adds the raw type and issuer to each chip', async () => {
    flags.showRawData = true;
    const chips = await applyChips();
    expect(chips.getByText('etf')).toBeTruthy();
    expect(chips.getByText('investors_mutual')).toBeTruthy();
  });

  it('shows only the labels when off', async () => {
    const chips = await applyChips();
    expect(chips.getByText('Investors Mutual')).toBeTruthy();
    expect(chips.queryByText('etf')).toBeNull();
    expect(chips.queryByText('investors_mutual')).toBeNull();
  });
});
