// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { config } from '../config';
import { fakeApi, renderApp } from '../../tests/component/app-harness';

const settings = config as { insightsEnabled: boolean };
const original = settings.insightsEnabled;

afterEach(() => {
  settings.insightsEnabled = original;
  cleanup();
  vi.restoreAllMocks();
});

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

describe('Insights tab in the gear panel', () => {
  it('opens from the gear with an Insights tab', async () => {
    renderApp(fakeApi());
    openPanel();

    expect(await screen.findByRole('tab', { name: 'Insights' })).toBeTruthy();
  });

  it('is absent when the insightsEnabled flag is off', async () => {
    settings.insightsEnabled = false;
    const api = fakeApi();
    renderApp(api);
    openPanel();

    await screen.findByRole('dialog');
    expect(screen.queryByRole('tab', { name: 'Insights' })).toBeNull();
    expect(api.zeroResults).not.toHaveBeenCalled();
  });

  it('fetches only once the panel is open', async () => {
    const api = fakeApi();
    renderApp(api);
    await screen.findByRole('button', { name: 'A200' });
    expect(api.zeroResults).not.toHaveBeenCalled();

    openPanel();
    await screen.findByText('bitcoin');
    expect(api.zeroResults).toHaveBeenCalledTimes(1);
  });

  it('shows the development-only banner and the demo-data label', async () => {
    renderApp(fakeApi());
    openPanel();

    expect(await screen.findByText(/development only/i)).toBeTruthy();
    expect(screen.getByText(/demo data/i)).toBeTruthy();
  });

  it('lists each group with its key, clients, total and spellings', async () => {
    renderApp(fakeApi());
    openPanel();
    const group = (await screen.findByText('bitcoin')).closest('li')!;

    expect(within(group).getByText('4 clients')).toBeTruthy();
    expect(within(group).getByText('9 searches')).toBeTruthy();
    expect(within(group).getByText('Bitcoin')).toBeTruthy();
    expect(within(group).getByText('7')).toBeTruthy();
    expect(within(group).getByText('BTC')).toBeTruthy();
    expect(screen.getByText('crypto')).toBeTruthy();
  });

  it('shows no spellings list for a group whose only spelling is its key', async () => {
    const api = fakeApi();
    api.zeroResults.mockResolvedValue({ groups: [{ key: 'tesla', clients: 5, total: 8, spellings: [{ text: 'tesla', total: 8 }] }], includes_seed_data: true });
    renderApp(api);
    openPanel();
    const group = (await screen.findByText('tesla')).closest('li')!;

    expect(within(group).queryByText('Searched as')).toBeNull();
    expect(within(group).getAllByText(/tesla/i)).toHaveLength(1);
  });

  it('labels the spellings "Searched as" when there are several or one differs from the key', async () => {
    renderApp(fakeApi());
    openPanel();
    const several = (await screen.findByText('bitcoin')).closest('li')!;
    expect(within(several).getByText('Searched as')).toBeTruthy();
    cleanup();

    const api = fakeApi();
    api.zeroResults.mockResolvedValue({ groups: [{ key: 'gas oil', clients: 3, total: 4, spellings: [{ text: 'oil gas', total: 4 }] }], includes_seed_data: true });
    renderApp(api);
    openPanel();
    const differing = (await screen.findByText('gas oil')).closest('li')!;
    expect(within(differing).getByText('Searched as')).toBeTruthy();
    expect(within(differing).getByText('oil gas')).toBeTruthy();
  });

  it('says so when there are no zero-result terms', async () => {
    const api = fakeApi();
    api.zeroResults.mockResolvedValue({ groups: [], includes_seed_data: true });
    renderApp(api);
    openPanel();

    expect(await screen.findByText('No zero-result terms yet')).toBeTruthy();
  });

  it('shows a loading state while it fetches', async () => {
    const api = fakeApi();
    api.zeroResults.mockReturnValue(new Promise(() => undefined));
    renderApp(api);
    openPanel();

    expect(await screen.findByText('Loading insights')).toBeTruthy();
  });

  it('explains a 404 as the API having insights disabled', async () => {
    const api = fakeApi();
    api.zeroResults.mockRejectedValue(new ApiError(404, 'not found'));
    renderApp(api);
    openPanel();

    expect(await screen.findByText(/ENABLE_INSIGHTS/)).toBeTruthy();
  });

  it('shows a generic message for other errors', async () => {
    const api = fakeApi();
    api.zeroResults.mockRejectedValue(new ApiError(500, 'boom'));
    renderApp(api);
    openPanel();

    expect(await screen.findByText('Could not load insights')).toBeTruthy();
    expect(screen.queryByText(/ENABLE_INSIGHTS/)).toBeNull();
  });

  it('passes axe', async () => {
    renderApp(fakeApi());
    openPanel();
    await screen.findByText('bitcoin');

    // axe's page-level landmark rule does not apply to a component under test.
    expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });
});
