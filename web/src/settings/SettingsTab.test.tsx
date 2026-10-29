// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { config, settingDescriptions } from '../config';
import { fakeApi, renderApp } from '../../tests/component/app-harness';
import { STORAGE_KEY } from './settings';

const flags = config as { settingsEnabled: boolean; insightsEnabled: boolean };
const original = { ...config } as typeof config & typeof flags;
const reload = vi.fn();

beforeEach(() => {
  localStorage.clear();
  reload.mockReset();
  vi.stubGlobal('location', { ...window.location, reload });
});
afterEach(() => {
  Object.assign(flags, original);
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LABELS = ['Results per load', 'Suggestion minimum characters', 'Issuer suggestions shown', 'Popular pills on phones', 'Popular pills on tablets', 'Popular pills on desktops', 'Recent searches kept'];
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

async function openSettings(api = fakeApi()) {
  renderApp(api);
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
  await screen.findByLabelText('Results per load');
  return api;
}
const confirmDialog = async (title: RegExp) => within(await screen.findByRole('alertdialog', { name: title }));

describe('Settings tab', () => {
  it('shows the original fields with the config descriptions as help text', async () => {
    await openSettings();

    for (const label of [...LABELS, 'Show raw data']) expect(screen.getByLabelText(label)).toBeTruthy();
    for (const text of Object.values(settingDescriptions)) expect(screen.getByText(text)).toBeTruthy();
  });

  it('is absent when the settingsEnabled flag is off, and Insights becomes the one tab', async () => {
    flags.settingsEnabled = false;
    renderApp(fakeApi());
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(await screen.findByRole('tab', { name: 'Insights' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull();
  });

  it('opens on Settings when Insights is off', async () => {
    flags.insightsEnabled = false;
    renderApp(fakeApi());
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(await screen.findByLabelText('Results per load')).toBeTruthy();
  });

  it('shows every editable setting, grouped under headings, and not settingsEnabled or searchStaleTimeMs', async () => {
    await openSettings();
    for (const label of ['Suggestion delay (ms)', 'API address', 'Featured searches', 'Most popular pills', 'Smallest last page', 'IDs per search request', 'Remember recent searches', 'Show the Insights tab', 'Send analytics events']) expect(screen.getByLabelText(label)).toBeTruthy();
    for (const name of ['Results', 'Suggestions', 'Popular and recent searches', 'API', 'Development features']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    expect(screen.queryByLabelText(/settings tab|settingsEnabled/i)).toBeNull();
    expect(screen.queryByLabelText(/stale/i)).toBeNull();
  });

  it('saves a URL, a list, a toggle and a number from the footer button, outside the form', async () => {
    await openSettings();
    const save = screen.getByRole('button', { name: 'Save and reload' });
    expect(save.closest('form')).toBeNull();
    fireEvent.change(screen.getByLabelText('API address'), { target: { value: ' https://api.example.com ' } });
    fireEvent.change(screen.getByLabelText('Featured searches'), { target: { value: 'vas, ioz' } });
    fireEvent.change(screen.getByLabelText('IDs per search request'), { target: { value: '200' } });
    fireEvent.click(screen.getByLabelText('Send analytics events'));
    await waitFor(() => expect((screen.getByLabelText('Send analytics events') as HTMLInputElement).checked).toBe(false));
    fireEvent.click(save);

    expect(stored()).toEqual({ apiBaseUrl: 'https://api.example.com', featuredSearches: ['VAS', 'IOZ'], idLimit: 200, analytics: false });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clamps the pills to the typed Most popular pills, and orphanSize below Results per load', async () => {
    await openSettings();
    fireEvent.change(screen.getByLabelText('Most popular pills'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Results per load'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Smallest last page'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));

    expect(stored()).toEqual({ popularMax: 5, popularMobile: 5, popularTablet: 5, popularDesktop: 5, documentLimit: 2, orphanSize: 1 });
  });

  it('shows saved strings, and falls back to the defaults when the stored ones are invalid', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiBaseUrl: 'ftp://nope', featuredSearches: ['vas'] }));
    await openSettings();
    expect((screen.getByLabelText('API address') as HTMLInputElement).value).toBe(original.apiBaseUrl);
    expect((screen.getByLabelText('Featured searches') as HTMLInputElement).value).toBe('vas');
  });

  it('puts the Save button in the drawer footer only on the Settings tab', async () => {
    renderApp(fakeApi());
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(await screen.findByRole('tab', { name: 'Insights' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save and reload' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByRole('button', { name: 'Save and reload' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Insights' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save and reload' })).toBeNull());
  });

  it('shows the one-line toggle after the popular sizes, on by default, and stores it only when turned off', async () => {
    await openSettings();
    const toggle = screen.getByLabelText('Keep popular pills on one line') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(screen.getByText(settingDescriptions.popularSearchOneLine)).toBeTruthy();
    const desktops = screen.getByLabelText('Popular pills on desktops');
    expect(desktops.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(toggle);
    await waitFor(() => expect((screen.getByLabelText('Keep popular pills on one line') as HTMLInputElement).checked).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));
    expect(stored()).toEqual({ popularSearchOneLine: false });
  });

  it('saves the changed values to localStorage and reloads', async () => {
    await openSettings();
    fireEvent.change(screen.getByLabelText('Results per load'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Popular pills on tablets'), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText('Show raw data'));
    // The checkbox reports its change a microtask after the click.
    await waitFor(() => expect((screen.getByLabelText('Show raw data') as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));

    expect(stored()).toEqual({ documentLimit: 25, popularTablet: 4, showRawData: true });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clamps a value outside its range and leaves a blank field at its default', async () => {
    await openSettings();
    fireEvent.change(screen.getByLabelText('Results per load'), { target: { value: '9999' } });
    fireEvent.change(screen.getByLabelText('Recent searches kept'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));

    expect(stored()).toEqual({ documentLimit: 50 });
  });

  it('shows the saved values when it opens', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentLimit: 30, showRawData: true }));
    await openSettings();

    expect((screen.getByLabelText('Results per load') as HTMLInputElement).value).toBe('30');
    expect((screen.getByLabelText('Show raw data') as HTMLInputElement).checked).toBe(true);
  });

  it('prefills every field with its current value, the three popular sizes included', async () => {
    await openSettings();

    expect((screen.getByLabelText('Results per load') as HTMLInputElement).value).toBe(String(original.documentLimit));
    expect((screen.getByLabelText('Popular pills on phones') as HTMLInputElement).value).toBe(String(original.popularShown.mobile));
    expect((screen.getByLabelText('Popular pills on tablets') as HTMLInputElement).value).toBe(String(original.popularShown.tablet));
    expect((screen.getByLabelText('Popular pills on desktops') as HTMLInputElement).value).toBe(String(original.popularShown.desktop));
  });

  it('stores only the changed popular size, and nothing once it is changed back', async () => {
    await openSettings();
    fireEvent.change(screen.getByLabelText('Popular pills on desktops'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));
    expect(stored()).toEqual({ popularDesktop: 9 });

    cleanup();
    await openSettings();
    fireEvent.change(screen.getByLabelText('Popular pills on desktops'), { target: { value: String(original.popularShown.desktop) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('says so and does not reload when storage refuses a save that removes the entry', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentLimit: 30 }));
    await openSettings();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.change(screen.getByLabelText('Results per load'), { target: { value: String(original.documentLimit) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));

    expect(await screen.findByText(/could not save/i)).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it('says so and does not reload when storage refuses the reset', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentLimit: 30 }));
    await openSettings();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(await screen.findByText(/could not reset the settings/i)).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it('says so and does not reload when storage refuses the save', async () => {
    await openSettings();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.change(screen.getByLabelText('Results per load'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));

    expect(await screen.findByText(/could not save/i)).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it('stores nothing for a field typed back to its default', async () => {
    await openSettings();
    fireEvent.change(screen.getByLabelText('Results per load'), { target: { value: String(original.documentLimit) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and reload' }));

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('shows how many custom settings are active, and nothing when there are none', async () => {
    await openSettings();
    expect(screen.queryByText(/custom settings active/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull();
    cleanup();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentLimit: 30, popularMobile: 3, popularDesktop: 5, popularSearchOneLine: false }));
    await openSettings();
    expect(screen.getByText('Custom settings active (4)')).toBeTruthy();
  });

  it('Reset to defaults clears the saved values and reloads', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentLimit: 30 }));
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('passes axe', async () => {
    await openSettings();

    expect((await axe(document.body, { rules: { region: { enabled: false } } })).violations).toEqual([]);
  });
});

describe('Reset popular searches', () => {
  it('Clear asks first, and cancelling does nothing', async () => {
    const api = await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Clear popular searches' }));
    fireEvent.click((await confirmDialog(/clear popular searches/i)).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.clearSearchLog).not.toHaveBeenCalled();
  });

  it('Clear, once confirmed, calls the API, says so and refetches the popular searches', async () => {
    const api = await openSettings();
    await screen.findByRole('button', { name: 'A200', hidden: true });
    expect(api.popular).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear popular searches' }));
    fireEvent.click((await confirmDialog(/clear popular searches/i)).getByRole('button', { name: 'Clear popular searches' }));

    expect(await screen.findByText('Popular searches cleared.')).toBeTruthy();
    expect(api.clearSearchLog).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.popular).toHaveBeenCalledTimes(2));
  });

  it('Restore demo popular searches asks first, then calls the API', async () => {
    const api = await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Restore demo popular searches' }));
    const dialog = await confirmDialog(/restore demo popular searches/i);
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.restoreSeed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Restore demo popular searches' }));
    fireEvent.click((await confirmDialog(/restore demo popular searches/i)).getByRole('button', { name: 'Restore demo popular searches' }));

    expect(await screen.findByText('Demo popular searches restored.')).toBeTruthy();
    expect(api.restoreSeed).toHaveBeenCalledTimes(1);
  });

  it('explains a 404 as the API having its development routes off', async () => {
    const api = fakeApi();
    api.clearSearchLog.mockRejectedValue(new ApiError(404, 'not found'));
    await openSettings(api);
    fireEvent.click(screen.getByRole('button', { name: 'Clear popular searches' }));
    fireEvent.click((await confirmDialog(/clear popular searches/i)).getByRole('button', { name: 'Clear popular searches' }));

    expect(await screen.findByText(/ENABLE_INSIGHTS/)).toBeTruthy();
  });

  it('shows a generic message for other errors', async () => {
    const api = fakeApi();
    api.restoreSeed.mockRejectedValue(new ApiError(500, 'boom'));
    await openSettings(api);
    fireEvent.click(screen.getByRole('button', { name: 'Restore demo popular searches' }));
    fireEvent.click((await confirmDialog(/restore demo popular searches/i)).getByRole('button', { name: 'Restore demo popular searches' }));

    expect(await screen.findByText('Could not reset popular searches.')).toBeTruthy();
    expect(screen.queryByText('Demo popular searches restored.')).toBeNull();
    expect(api.popular).toHaveBeenCalledTimes(1);
  });
});
