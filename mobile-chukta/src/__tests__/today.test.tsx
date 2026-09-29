import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { TodayScreen } from '../screens/TodayScreen';
import { att, property, worker } from './helpers/fixtures';
import { makeSession, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

async function seeded() {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w2', name: 'Sita', pay_basis: 'hourly' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w3', name: 'Off', weekly_off_override: 1, weekly_off: 1 })); // Monday off
  return s;
}
const rowsFor = (s: Awaited<ReturnType<typeof seeded>>, id: string) =>
  s.db.getAllAsync<{ status: string; hours: number | null; date: string; created_by_role: string }>(
    'select status, hours, date, created_by_role from attendance_entries where worker_id = ? order by created_at, id', [id]);

test('marking a worker absent writes one entry for today as staff', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('status-w1-absent'));
  await waitFor(async () => expect(await rowsFor(s, 'w1')).toEqual([{ status: 'absent', hours: null, date: '2026-09-07', created_by_role: 'staff' }]));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('pressing the status the day already has writes nothing', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('status-w1-present'));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(await rowsFor(s, 'w1')).toEqual([]);
});

test('hours mode: valid hours are saved, invalid hours show an error', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.changeText(await screen.findByTestId('hours-w2'), '30');
  fireEvent.press(screen.getByTestId('hours-save-w2'));
  expect(await screen.findByText('Enter hours between 0 and 24.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('hours-w2'), '5.5');
  fireEvent.press(screen.getByTestId('hours-save-w2'));
  await waitFor(async () => expect((await rowsFor(s, 'w2')).map((r) => [r.status, r.hours])).toEqual([['hours', 5.5]]));
});

test('weekly-off workers show Weekly off and have no controls', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  expect(await screen.findByText('Weekly off')).toBeTruthy();
  expect(screen.queryByTestId('status-w3-absent')).toBeNull();
});

test('bulk: long-press to select, then mark all selected half day', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent(await screen.findByTestId('row-w1'), 'longPress');
  fireEvent(screen.getByTestId('row-w2'), 'longPress');
  expect(screen.getByText('2 selected')).toBeTruthy();
  fireEvent.press(screen.getByTestId('bulk-half_day'));
  await waitFor(async () => {
    expect((await rowsFor(s, 'w1')).map((r) => r.status)).toEqual(['half_day']);
    expect((await rowsFor(s, 'w2')).map((r) => r.status)).toEqual(['half_day']);
  });
});

test('shows the effective status (latest entry wins) after a reload', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-07', 'absent', { worker_id: 'w1', created_at: '2026-09-07T08:00:00Z' }));
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-07', 'half_day', { worker_id: 'w1', created_at: '2026-09-07T09:00:00Z' }));
  renderScreen('Tabs', TodayScreen, s);
  await waitFor(() => expect(screen.getByTestId('status-w1-half_day').props.accessibilityState.selected).toBe(true));
});

test('the hours field does not carry a stale value across a date change', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-07', 'hours', { worker_id: 'w2', hours: 5.5 }));
  renderScreen('Tabs', TodayScreen, s);
  await waitFor(() => expect(screen.getByTestId('hours-w2').props.value).toBe('5.5'));
  fireEvent.press(screen.getByTestId('today-date'));
  fireEvent(screen.getByTestId('date-picker'), 'change', { type: 'set' }, new Date(2026, 8, 5));
  await waitFor(() => expect(screen.getByTestId('hours-w2').props.value).toBe(''));
});

test('double-pressing the same status before the write settles writes only one entry', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  const btn = await screen.findByTestId('status-w1-absent');
  fireEvent.press(btn);
  fireEvent.press(btn);
  await waitFor(async () => expect(await rowsFor(s, 'w1')).toHaveLength(1));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect((await rowsFor(s, 'w1')).map((r) => r.status)).toEqual(['absent']);
});
