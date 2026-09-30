import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SyncIssuesScreen } from '../screens/SyncIssuesScreen';
import * as deadLetters from '../sync/deadLetters';
import { IDLE_STATUS } from '../sync/engine';
import { makeSession, OWNER, renderScreen } from './helpers/session';

jest.mock('../app/services', () => ({ authService: {}, staffApi: {} }));
beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

async function withDead() {
  const s = await makeSession(OWNER);
  for (const [table, id, err] of [['workers', 'w1', 'violates check'], ['attendance_entries', 'a1', 'violates check']]) {
    await s.db.runAsync("insert into sync_queue (table_name, row_id, op, payload, status, attempts, last_error, created_at) values (?, ?, 'insert', '{}', 'dead', 1, ?, 't')",
      [table, id, err]);
  }
  return s;
}

test('settings links to the issues screen when something is dead', async () => {
  const s = await makeSession(OWNER, { syncStatus: { ...IDLE_STATUS, dead: 2 } });
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('sync-issues'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('SyncIssues');
});

test('no issues row when nothing is dead', async () => {
  const s = await makeSession(OWNER);
  renderScreen('Tabs', SettingsScreen, s);
  await screen.findByTestId('logout');
  expect(screen.queryByTestId('sync-issues')).toBeNull();
});

test('groups by error; retry puts rows back to pending and syncs', async () => {
  const s = await withDead();
  renderScreen('SyncIssues', SyncIssuesScreen, s);
  expect(await screen.findByText('violates check')).toBeTruthy();
  expect(screen.getByText('2 entries · Worker, Attendance')).toBeTruthy();
  fireEvent.press(screen.getByTestId('retry-0'));
  await waitFor(async () => expect(await s.db.getAllAsync("select 1 from sync_queue where status = 'pending'")).toHaveLength(2));
  expect(s.runSync).toHaveBeenCalled();
});

test('discard asks first, then removes the rows', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { void buttons?.[1]?.onPress?.(); });
  const s = await withDead();
  renderScreen('SyncIssues', SyncIssuesScreen, s);
  fireEvent.press(await screen.findByTestId('discard-0'));
  await waitFor(async () => expect(await s.db.getAllAsync('select 1 from sync_queue')).toHaveLength(0));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('a second tap on Retry while the first is in flight is ignored', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const spy = jest.spyOn(deadLetters, 'requeueDead').mockImplementation(async () => { await gate; });
  const s = await withDead();
  renderScreen('SyncIssues', SyncIssuesScreen, s);
  const retry = await screen.findByTestId('retry-0');
  fireEvent.press(retry);
  fireEvent.press(retry);
  fireEvent.press(retry);
  release();
  await waitFor(() => expect(retry.props.accessibilityState.disabled).toBe(false));
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});
