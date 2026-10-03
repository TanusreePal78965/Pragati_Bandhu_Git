// SettingsScreen imports the Supabase-backed services; keep tests off the network client.
jest.mock('../app/services', () => ({ authService: {}, staffApi: {} }));

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { HolidayFormScreen } from '../screens/HolidayFormScreen';
import { HolidaysScreen } from '../screens/HolidaysScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { property } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

const rows = (s: Awaited<ReturnType<typeof makeSession>>) =>
  s.db.getAllAsync<{ name: string; date: string; portion: string; pay_rule: string; is_active: number }>(
    'select name, date, portion, pay_rule, is_active from days_off order by created_at');

test('owner adds a half-day unpaid holiday from a suggestion', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('HolidayForm', HolidayFormScreen, s);
  fireEvent.press(await screen.findByText('Durga Puja'));
  fireEvent.press(screen.getByTestId('portion-half'));
  fireEvent.press(screen.getByTestId('payRule-all_unpaid'));
  fireEvent.press(screen.getByTestId('holiday-save'));
  await waitFor(async () => expect(await rows(s)).toEqual([
    { name: 'Durga Puja', date: '2026-09-07', portion: 'half', pay_rule: 'all_unpaid', is_active: 1 },
  ]));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('empty name shows an error and writes nothing', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('HolidayForm', HolidayFormScreen, s);
  fireEvent.press(await screen.findByTestId('holiday-save'));
  expect(await screen.findByText('Enter a name.')).toBeTruthy();
  expect(await rows(s)).toEqual([]);
});

test('list splits upcoming and past and shows removed ones', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  const base = { property_id: 'p1', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', created_by: 'u1', created_by_role: 'owner',
    created_at: '2026-09-01T00:00:00Z', server_updated_at: null };
  await upsertLocal(s.db, 'days_off', { ...base, id: 'd1', date: '2026-10-20', name: 'Durga Puja', is_active: 1 });
  await upsertLocal(s.db, 'days_off', { ...base, id: 'd2', date: '2026-09-01', name: 'Old', is_active: 0 });
  renderScreen('Holidays', HolidaysScreen, s);
  expect(await screen.findByText('Upcoming')).toBeTruthy();
  expect(screen.getByText('Durga Puja')).toBeTruthy();
  expect(screen.getByText('Past')).toBeTruthy();
  expect(screen.getByText('Removed')).toBeTruthy();
});

test('owner can remove a holiday from the edit form', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'days_off', { id: 'd1', property_id: 'p1', date: '2026-10-20', name: 'Durga Puja', kind: 'holiday', portion: 'full',
    pay_rule: 'by_basis', is_active: 1, created_by: 'u1', created_by_role: 'owner', created_at: 't', server_updated_at: null });
  renderScreen('HolidayForm', HolidayFormScreen, s, { dayOffId: 'd1' });
  fireEvent(await screen.findByTestId('holiday-active'), 'valueChange', false);
  fireEvent.press(screen.getByTestId('holiday-save'));
  await waitFor(async () => expect((await rows(s))[0].is_active).toBe(0));
});

test('staff do not see the Holidays row in Settings', async () => {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('Tabs', SettingsScreen, s);
  await screen.findByText('Main');
  expect(screen.queryByTestId('holidays')).toBeNull();
});
