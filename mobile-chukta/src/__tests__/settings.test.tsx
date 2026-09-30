// SettingsScreen gains a section that imports the Supabase-backed services (Task 15); keep tests off the network client.
jest.mock('../app/services', () => ({ authService: {}, staffApi: {} }));

import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { SettingsScreen } from '../screens/SettingsScreen';
import { IDLE_STATUS } from '../sync/engine';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

test('logout asks first when entries are still waiting to sync', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const s = await makeSession(OWNER, { syncStatus: { ...IDLE_STATUS, pending: 2 } });
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('logout'));
  expect(alert).toHaveBeenCalledWith('Log out', expect.stringContaining('2 entries'), expect.any(Array));
  expect(s.logout).not.toHaveBeenCalled();
});

test('logout goes straight through when nothing is pending; sync now runs a sync', async () => {
  const s = await makeSession(OWNER);
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('sync-now'));
  expect(s.runSync).toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('logout'));
  expect(s.logout).toHaveBeenCalled();
});

test('shows who is logged in and the last sync time', async () => {
  const s = await makeSession(STAFF, { syncStatus: { ...IDLE_STATUS, lastSyncedAt: new Date(2026, 8, 7, 9, 5).toISOString() } });
  renderScreen('Tabs', SettingsScreen, s);
  expect(await screen.findByText('Logged in as Mgr')).toBeTruthy();
  expect(screen.getByTestId('sync-line').props.children).toBe('Last synced 09:05');
});

test('language row opens the Language route', async () => {
  const s = await makeSession(OWNER);
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('language'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('Language');
});
