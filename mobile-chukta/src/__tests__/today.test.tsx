import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { TodayScreen } from '../screens/TodayScreen';
import { att, property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

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

test('weekly-off workers show Weekly off, with work-on-a-day-off controls and no overtime link', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  expect(await screen.findByText('Weekly off')).toBeTruthy();
  expect(screen.getByTestId('status-w3-absent')).toBeTruthy(); expect(screen.queryByTestId('ot-open-w3')).toBeNull();
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

test('after midnight Today moves to the new day, so a tap writes to the new date', async () => {
  const s = await seeded();
  const { rerenderWith } = renderScreen('Tabs', TodayScreen, s);
  await screen.findByTestId('status-w1-absent');
  const next = { ...s, version: s.version + 1, repo: { ...s.repo, now: () => new Date(2026, 8, 8, 0, 5) } };
  rerenderWith(next);
  fireEvent.press(await screen.findByTestId('status-w1-absent'));
  await waitFor(async () => expect((await rowsFor(s, 'w1')).map((r) => r.date)).toEqual(['2026-09-08']));
});

const dayOffRow = (over: object = {}) => ({ id: 'd1', property_id: 'p1', date: '2026-09-07', name: 'Bandh', kind: 'closure', portion: 'full',
  pay_rule: 'by_basis', is_active: 1, created_by: 'u2', created_by_role: 'staff', created_at: '2026-09-07T08:00:00Z', server_updated_at: null, ...over });

test('staff marks the shop closed with a reason chip', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('closure-open'));
  fireEvent.press(screen.getByText('Rain'));
  fireEvent.press(screen.getByTestId('closure-save'));
  await waitFor(async () => expect(await s.db.getAllAsync('select name, kind, portion, created_by_role from days_off'))
    .toEqual([{ name: 'Rain', kind: 'closure', portion: 'full', created_by_role: 'staff' }]));
  expect(await screen.findByTestId('dayoff-banner')).toBeTruthy(); // the card gives way to the banner
});

test('on a closed day rows show the banner and Worked / Not worked; no entry means not worked', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'days_off', dayOffRow());
  renderScreen('Tabs', TodayScreen, s);
  expect(await screen.findByTestId('dayoff-banner')).toBeTruthy();
  expect(screen.queryByTestId('closure-open')).toBeNull();
  fireEvent.press(screen.getByTestId('status-w1-absent')); // "Not worked" = already the state → no write
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(await rowsFor(s, 'w1')).toEqual([]);
  fireEvent.press(screen.getByTestId('status-w1-present')); // "Worked"
  await waitFor(async () => expect((await rowsFor(s, 'w1')).map((r) => r.status)).toEqual(['present']));
  expect(screen.getAllByText('Worked').length).toBeGreaterThan(0);
});

test('overtime: staff saves 2 hours; invalid input shows an error; owner-only custom amount is hidden for staff', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('ot-open-w1'));
  expect(screen.queryByTestId('ot-amount-w1')).toBeNull();
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '20');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  expect(await screen.findByText('Enter 0 to 16 hours.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '2');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  await waitFor(async () => expect(await s.db.getAllAsync('select hours, custom_amount_paise from overtime_entries'))
    .toEqual([{ hours: 2, custom_amount_paise: null }]));
  expect(await screen.findByText('OT 2 h')).toBeTruthy();
});

test('owner can record work on a day off with a custom amount', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'days_off', dayOffRow({ created_by_role: 'owner', created_by: 'u1' }));
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.changeText(await screen.findByTestId('offday-amount-w1'), '800');
  fireEvent.press(screen.getByTestId('status-w1-present'));
  await waitFor(async () => expect(await s.db.getAllAsync('select status, custom_amount_paise from attendance_entries'))
    .toEqual([{ status: 'present', custom_amount_paise: 80000 }]));
});

test('double-tapping overtime Save or closure Save writes only once', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('ot-open-w1'));
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '1.5');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  expect(await screen.findByText('OT 1.5 h')).toBeTruthy();
  expect(await s.db.getAllAsync('select hours from overtime_entries')).toEqual([{ hours: 1.5 }]);
  fireEvent.press(screen.getByTestId('closure-open'));
  fireEvent.changeText(screen.getByTestId('closure-reason'), 'Strike');
  fireEvent.press(screen.getByTestId('closure-save'));
  fireEvent.press(screen.getByTestId('closure-save'));
  expect(await screen.findByTestId('dayoff-banner')).toBeTruthy();
  expect(await s.db.getAllAsync('select name from days_off')).toEqual([{ name: 'Strike' }]);
});

test('owner overtime: a custom amount is saved in paise, and 0 means not set', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('ot-open-w1'));
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '2');
  fireEvent.changeText(screen.getByTestId('ot-amount-w1'), 'abc');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  expect(await screen.findByText('Enter a valid amount.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('ot-amount-w1'), '0');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  expect(await screen.findByText('OT 2 h')).toBeTruthy();
  fireEvent.press(screen.getByTestId('ot-open-w1'));
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '3');
  fireEvent.changeText(screen.getByTestId('ot-amount-w1'), '150');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  expect(await screen.findByText('OT 3 h')).toBeTruthy();
  expect(await s.db.getAllAsync('select hours, custom_amount_paise from overtime_entries order by created_at, id'))
    .toEqual([{ hours: 2, custom_amount_paise: null }, { hours: 3, custom_amount_paise: 15000 }]);
});

test('owner editing overtime hours keeps the existing custom amount', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'overtime_entries', { id: 'o1', property_id: 'p1', worker_id: 'w1', date: '2026-09-07', hours: 2,
    custom_amount_paise: 15000, note: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-06T12:00:00Z', server_updated_at: null });
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('ot-open-w1'));
  expect(screen.getByTestId('ot-amount-w1').props.value).toBe('150');
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '3');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  expect(await screen.findByText('OT 3 h')).toBeTruthy();
  expect(await s.db.getAllAsync("select hours, custom_amount_paise from overtime_entries where id != 'o1'"))
    .toEqual([{ hours: 3, custom_amount_paise: 15000 }]);
});

test('a half-day closure on the weekly off still reads Weekly off for that worker', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'days_off', dayOffRow({ portion: 'half' }));
  renderScreen('Tabs', TodayScreen, s);
  expect(await screen.findByText('Weekly off')).toBeTruthy(); // w3 (Monday off)
  expect(screen.getAllByText('Bandh · half day').length).toBeGreaterThan(0); // banner and working rows
});
