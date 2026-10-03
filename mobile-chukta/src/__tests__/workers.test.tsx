import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { settleWorker, unlockSettlement } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { WorkerDetailScreen } from '../screens/WorkerDetailScreen';
import { WorkerFormScreen } from '../screens/WorkerFormScreen';
import { WorkersScreen } from '../screens/WorkersScreen';
import { adv, att, pay, property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

async function seeded(identity = OWNER) {
  const s = await makeSession(identity);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w2', name: 'Gone', status: 'left', left_date: '2026-09-03' }));
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-03', 'absent'));
  await upsertLocal(s.db, 'advance_entries', adv('a1'));
  await upsertLocal(s.db, 'wage_payments', pay('p1'));
  return s;
}

test('workers list shows wage due and advance; left workers only on request', async () => {
  const s = await seeded();
  renderScreen('Tabs', WorkersScreen, s);
  expect(await screen.findByText('Wage due ₹2,000')).toBeTruthy(); // 5 days × ₹500 − ₹500 paid
  expect(screen.getByText('Advance ₹1,000')).toBeTruthy();
  expect(screen.queryByTestId('worker-w2')).toBeNull();
  fireEvent(screen.getByTestId('show-left'), 'valueChange', true);
  expect(await screen.findByTestId('worker-w2')).toBeTruthy();
  fireEvent.press(screen.getByTestId('worker-w1'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('WorkerDetail');
});

test('worker detail: balances, explanation, calendar and history', async () => {
  const s = await seeded();
  // Full-shift hours (8/8 = credit 1, same as an implicit "present" day) so this doesn't
  // perturb the "5 days × ₹500" / "₹2,000 due" assertions below.
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-04', 'hours', { hours: 8 }));
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId('due')).toHaveTextContent('₹2,000');
  fireEvent.press(screen.getByTestId('explain-toggle'));
  expect(screen.getByText('5 days × ₹500')).toBeTruthy();
  expect(screen.getByTestId('day-2026-09-03').props.accessibilityLabel).toMatch(/Absent/);
  // The hours badge goes through t('today.hoursValue'), not a hardcoded "h" suffix.
  expect(screen.getByText('8 h')).toBeTruthy();
  // History rows (Task 14 adds buttons with the same labels, hence getAll).
  expect(screen.getAllByText('Advance').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Wage payment').length).toBeGreaterThan(0);
});

test('owner corrects a payment: a void row is written and totals exclude it', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { void buttons?.[1]?.onPress?.(); });
  const s = await seeded();
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  fireEvent.press(await screen.findByTestId('correct-p1'));
  await waitFor(async () => {
    const rows = await s.db.getAllAsync<{ voids_id: string | null }>('select voids_id from wage_payments order by created_at');
    expect(rows.map((r) => r.voids_id)).toEqual([null, 'p1']);
  });
  expect(s.afterWrite).toHaveBeenCalled();
});

test('staff never see Correct', async () => {
  const s = await seeded(STAFF);
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  await screen.findByTestId('due');
  expect(screen.queryByTestId('correct-p1')).toBeNull();
});

test('add worker: validates, then writes a worker with property defaults as the base', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property({ default_pay_basis: 'monthly' }));
  renderScreen('WorkerForm', WorkerFormScreen, s);
  fireEvent.press(await screen.findByTestId('save'));
  expect(await screen.findByText('Enter a name.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('name'), 'Sita');
  fireEvent.changeText(screen.getByTestId('rate'), '15,000');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => {
    const w = await s.db.getFirstAsync<{ name: string; pay_basis: string; rate_paise: number; joining_date: string; weekly_off_override: number }>(
      'select name, pay_basis, rate_paise, joining_date, weekly_off_override from workers');
    expect(w).toEqual({ name: 'Sita', pay_basis: 'monthly', rate_paise: 1500000, joining_date: '2026-09-07', weekly_off_override: 0 });
  });
});

test('edit worker: mark as left sends an update patch', async () => {
  const s = await seeded();
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('has-left'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => {
    const q = await s.db.getAllAsync<{ op: string; payload: string }>("select op, payload from sync_queue where op = 'update'");
    expect(JSON.parse(q[0].payload)).toMatchObject({ id: 'w1', status: 'left', left_date: '2026-09-07' });
  });
});

test('worker override: 1.5× overtime, other extra-pay settings follow the property', async () => {
  const s = await seeded();
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('overrides'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('worker-extra-otMode-multiplier'));
  fireEvent.press(screen.getByTestId('worker-extra-otMultiplier-1.5'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select offday_multiplier, ot_mode, ot_multiplier, ot_rate_paise from workers where id = ?', ['w1']))
    .toEqual({ offday_multiplier: null, ot_mode: 'multiplier', ot_multiplier: 1.5, ot_rate_paise: null }));
});

test('staff can edit a worker; the Extra pay section is hidden and pay settings are untouched', async () => {
  const s = await seeded(STAFF);
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('overrides'), 'valueChange', true);
  expect(screen.queryByText('Extra pay')).toBeNull();
  expect(screen.queryByTestId('worker-extra-otMode-fixed')).toBeNull();
  fireEvent.changeText(screen.getByTestId('name'), 'Ramesh');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select name from workers where id = ?', ['w1'])).toEqual({ name: 'Ramesh' }));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('owner sees the due list and opens Settle from it', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker());
  renderScreen('Tabs', WorkersScreen, s);
  expect(await screen.findByText('Due for settlement')).toBeTruthy();
  expect(screen.getByText('1–5 Sep · ₹2,500 due')).toBeTruthy();
  fireEvent.press(screen.getByTestId('due-w1'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('Settle');
});

test('staff never see the due list', async () => {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker());
  renderScreen('Tabs', WorkersScreen, s);
  await screen.findByTestId('worker-w1');
  expect(screen.queryByText('Due for settlement')).toBeNull();
  expect(screen.queryByTestId('due-w1')).toBeNull();
});

test('worker detail lists payslips, marks unlocked ones and opens one; the calendar locks settled days', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker());
  const first = await settleWorker(s.repo, { worker: worker(), property: property(), periodStart: '2026-09-01', today: '2026-09-07',
    paidNowPaise: 200000, recoveredPaise: 0, mode: 'cash' });
  await unlockSettlement(s.repo, first.id, '2026-09-07');
  const again = await settleWorker(s.repo, { worker: worker(), property: property(), periodStart: '2026-09-01', today: '2026-09-07',
    paidNowPaise: 0, recoveredPaise: 0, mode: null });
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  const newer = within(await screen.findByTestId(`payslip-${again.id}`));
  const older = within(screen.getByTestId(`payslip-${first.id}`));
  // Newest first: the new slip is listed above the unlocked one.
  const ids = screen.getAllByTestId(/^payslip-/).map((e) => e.props.testID);
  expect(ids).toEqual([`payslip-${again.id}`, `payslip-${first.id}`]);
  expect(newer.getByText('1–5 Sep')).toBeTruthy();
  expect(newer.getByText('₹0')).toBeTruthy();
  expect(newer.queryByText('Unlocked')).toBeNull();
  expect(older.getByText('1–5 Sep')).toBeTruthy();
  expect(older.getByText('₹2,000')).toBeTruthy(); // paid now ₹2,000 + recovered ₹0
  expect(older.getByText('Unlocked')).toBeTruthy();
  expect(screen.queryByText('No payslips yet.')).toBeNull();
  // 1–5 Sep is settled again; 7 Sep (today) is not.
  expect(screen.getByTestId('day-2026-09-03').props.accessibilityLabel).toContain('Settled');
  expect(screen.getByTestId('day-2026-09-07').props.accessibilityLabel).not.toContain('Settled');
  expect(screen.queryByTestId('settle-open')).toBeNull(); // 6–12 Sep isn't over on 7 Sep
  fireEvent.press(screen.getByTestId(`payslip-${again.id}`));
  expect((await screen.findByTestId('current-route')).props.children).toBe('Payslip');
});

test('staff see payslips but no Settle button', async () => {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker());
  const slip = await settleWorker({ ...s.repo, role: 'owner' }, { worker: worker(), property: property(), periodStart: '2026-09-01', today: '2026-09-07',
    paidNowPaise: 0, recoveredPaise: 0, mode: null });
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId(`payslip-${slip.id}`)).toBeTruthy();
  expect(screen.queryByTestId('settle-open')).toBeNull();
});

test('worker form: owner sets a weekly cycle ending Wednesday', async () => {
  const s = await seeded();
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('overrides'), 'valueChange', true);
  expect(screen.getByText('Pay cycle')).toBeTruthy();
  fireEvent.press(screen.getByTestId('worker-cycle-weekly'));
  fireEvent.press(screen.getByTestId('worker-cycle-end-3'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select pay_cycle, cycle_end_weekday from workers where id = ?', ['w1']))
    .toEqual({ pay_cycle: 'weekly', cycle_end_weekday: 3 }));
});

test('worker form: switching overrides off resets the pay cycle to the property setting', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram', pay_cycle: 'monthly', cycle_end_weekday: 2 }));
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  expect((await screen.findByTestId('worker-cycle-monthly')).props.accessibilityState.selected).toBe(true);
  fireEvent(screen.getByTestId('overrides'), 'valueChange', false);
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select pay_cycle, cycle_end_weekday from workers where id = ?', ['w1']))
    .toEqual({ pay_cycle: null, cycle_end_weekday: null }));
});

test('worker form: a monthly-paid worker is always settled by month', async () => {
  const s = await seeded();
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('overrides'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('basis-monthly'));
  expect(screen.getByText('Monthly-paid workers are always settled by month.')).toBeTruthy();
  expect(screen.queryByTestId('worker-cycle-weekly')).toBeNull();
});

test('staff never see the pay cycle on the worker form', async () => {
  const s = await seeded(STAFF);
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('overrides'), 'valueChange', true);
  expect(screen.queryByText('Pay cycle')).toBeNull();
  expect(screen.queryByTestId('worker-cycle-weekly')).toBeNull();
});
