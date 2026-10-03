import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import * as moneyRepo from '../repos/money';
import { upsertLocal } from '../repos/write';
import { AdvancesScreen } from '../screens/AdvancesScreen';
import { MoneyEntryScreen } from '../screens/MoneyEntryScreen';
import { WorkerDetailScreen } from '../screens/WorkerDetailScreen';
import { adv, property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

async function seeded() {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w2', name: 'Sita' }));
  return s;
}

test('staff records an advance by UPI', async () => {
  const s = await seeded();
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'advance' });
  fireEvent.changeText(await screen.findByTestId('amount'), '1,500.50');
  fireEvent.press(screen.getByTestId('mode-upi'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => {
    const r = await s.db.getFirstAsync('select type, amount_paise, mode, date, created_by_role from advance_entries');
    expect(r).toEqual({ type: 'advance', amount_paise: 150050, mode: 'upi', date: '2026-09-07', created_by_role: 'staff' });
  });
  expect(s.afterWrite).toHaveBeenCalled();
});

test('write-off requires a note', async () => {
  const s = await seeded();
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'writeoff' });
  fireEvent.changeText(await screen.findByTestId('amount'), '100');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('A note is required for a write-off.')).toBeTruthy();
  expect(await s.db.getAllAsync('select 1 from advance_entries')).toEqual([]);
});

test('write-off hides the mode picker and saves mode null', async () => {
  const s = await seeded();
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'writeoff' });
  fireEvent.changeText(await screen.findByTestId('amount'), '100');
  expect(screen.queryByTestId('mode-cash')).toBeNull();
  fireEvent.changeText(screen.getByTestId('note'), 'left town');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select type, mode, note from advance_entries'))
    .toEqual({ type: 'writeoff', mode: null, note: 'left town' }));
});

test('a failed local save shows an error and enables Save again', async () => {
  const s = await seeded();
  const spy = jest.spyOn(moneyRepo, 'addAdvance').mockRejectedValueOnce(new Error('disk'));
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'advance' });
  fireEvent.changeText(await screen.findByTestId('amount'), '100');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('Could not save on this phone. Please try again.')).toBeTruthy();
  expect(screen.getByTestId('save').props.accessibilityState.disabled).toBe(false);
  expect(s.afterWrite).not.toHaveBeenCalled();
  spy.mockRestore();
});

test('a wage payment goes to wage_payments', async () => {
  const s = await seeded();
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w2', kind: 'payment' });
  fireEvent.changeText(await screen.findByTestId('amount'), '2000');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select amount_paise from wage_payments')).toEqual({ amount_paise: 200000 }));
});

test('worker detail offers all four money actions, including to staff', async () => {
  const s = await seeded();
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  for (const k of ['advance', 'repayment', 'writeoff', 'payment']) expect(await screen.findByTestId(`add-${k}`)).toBeTruthy();
  fireEvent.press(screen.getByTestId('add-repayment'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('MoneyEntry');
});

test('advances tab lists outstanding advances, largest first, with the total', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'advance_entries', adv('a1', { worker_id: 'w1', amount_paise: 100000 }));
  await upsertLocal(s.db, 'advance_entries', adv('a2', { worker_id: 'w2', amount_paise: 300000 }));
  await upsertLocal(s.db, 'advance_entries', adv('a3', { worker_id: 'w2', type: 'repayment', amount_paise: 50000 }));
  renderScreen('Tabs', AdvancesScreen, s);
  expect(await screen.findByTestId('advances-total')).toHaveTextContent('₹3,500');
  const order = screen.getAllByTestId(/^advance-/).map((n) => n.props.testID);
  expect(order).toEqual(['advance-w2', 'advance-w1']);
});

test('a repayment above the outstanding advance shows a non-blocking warning', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'advance_entries', adv('a1', { amount_paise: 100000 })); // ₹1,000 outstanding
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'repayment' });
  fireEvent.changeText(await screen.findByTestId('amount'), '500');
  expect(screen.queryByTestId('exceeds-advance')).toBeNull();
  fireEvent.changeText(screen.getByTestId('amount'), '1500');
  expect(await screen.findByTestId('exceeds-advance')).toHaveTextContent('This is more than the ₹1,000 advance outstanding.');
  fireEvent.press(screen.getByTestId('save')); // still allowed — it's a warning, not a block
  await waitFor(async () => expect(await s.db.getFirstAsync('select amount_paise from advance_entries where type = ?', ['repayment']))
    .toEqual({ amount_paise: 150000 }));
});

test('the warning never shows for an advance or a payment', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'advance_entries', adv('a1', { amount_paise: 100000 }));
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'advance' });
  fireEvent.changeText(await screen.findByTestId('amount'), '99999999');
  expect(screen.queryByTestId('exceeds-advance')).toBeNull();
});

test('owner adds a deduction (reason required, no mode picker)', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'deduction' });
  fireEvent.changeText(await screen.findByTestId('amount'), '200');
  expect(screen.queryByTestId('mode-cash')).toBeNull();
  expect(screen.getByText('Reason (required)')).toBeTruthy();
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('A reason is required for a deduction.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('note'), 'Broken glass');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getAllAsync('select type, amount_paise, note, created_by_role from earning_adjustments'))
    .toEqual([{ type: 'deduction', amount_paise: 20000, note: 'Broken glass', created_by_role: 'owner' }]));
});

test('a non-owner reaching a bonus entry sees nothing writable', async () => {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'bonus' });
  expect(await screen.findByText('Only the owner can do this.')).toBeTruthy();
  expect(screen.queryByTestId('save')).toBeNull();
  expect(screen.queryByTestId('amount')).toBeNull();
});

async function ownerWithBonus() {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'earning_adjustments', { id: 'b1', property_id: 'p1', worker_id: 'w1', type: 'bonus', amount_paise: 50000,
    date: '2026-09-05', note: null, voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-05T10:00:00Z', server_updated_at: null });
  return s;
}

test('worker detail: owner sees Bonus/Deduction, the ledger includes the bonus, and a deduction row shows a minus', async () => {
  const s = await ownerWithBonus();
  await upsertLocal(s.db, 'earning_adjustments', { id: 'd1', property_id: 'p1', worker_id: 'w1', type: 'deduction', amount_paise: 20000,
    date: '2026-09-06', note: 'Glass', voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-06T10:00:00Z', server_updated_at: null });
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId('add-bonus')).toBeTruthy();
  expect(screen.getByTestId('add-deduction')).toBeTruthy();
  fireEvent.press(screen.getByTestId('explain-toggle'));
  expect(screen.getByText('Bonus: ₹500')).toBeTruthy();
  expect(screen.getByTestId('correct-b1')).toBeTruthy();
  expect(screen.getByText('−₹200')).toBeTruthy();
});

test('worker detail: correcting a bonus voids it', async () => {
  const s = await ownerWithBonus();
  const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  try {
    fireEvent.press(await screen.findByTestId('correct-b1'));
    const buttons = alert.mock.calls[0][2] as { onPress?: () => void }[];
    await buttons[1].onPress?.();
    await waitFor(async () => expect(await s.db.getAllAsync('select voids_id from earning_adjustments where voids_id is not null')).toEqual([{ voids_id: 'b1' }]));
  } finally {
    alert.mockRestore();
  }
});

test('worker detail: staff do not see Bonus/Deduction', async () => {
  const st = await makeSession(STAFF);
  await upsertLocal(st.db, 'properties', property());
  await upsertLocal(st.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  renderScreen('WorkerDetail', WorkerDetailScreen, st, { workerId: 'w1' });
  await screen.findAllByText('Ram');
  expect(screen.queryByTestId('add-bonus')).toBeNull();
  expect(screen.queryByTestId('add-deduction')).toBeNull();
});

test('calendar marks a day off, work on a day off, and overtime', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram', joining_date: '2026-09-01' }));
  const dayOff = (id: string, date: string) => ({ id, property_id: 'p1', date, name: 'Holi', kind: 'holiday', portion: 'full', pay_rule: 'by_basis',
    is_active: 1, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-01T09:00:00Z', server_updated_at: null });
  await upsertLocal(s.db, 'days_off', dayOff('d1', '2026-09-03'));
  await upsertLocal(s.db, 'days_off', dayOff('d2', '2026-09-04'));
  await upsertLocal(s.db, 'attendance_entries', { id: 'at1', property_id: 'p1', worker_id: 'w1', date: '2026-09-04', status: 'present', hours: null, note: null,
    created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-04T09:00:00Z', server_updated_at: null });
  await upsertLocal(s.db, 'overtime_entries', { id: 'o1', property_id: 'p1', worker_id: 'w1', date: '2026-09-02', hours: 2, custom_amount_paise: null, note: null,
    created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-02T18:00:00Z', server_updated_at: null });
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  const day = async (d: string) => within(await screen.findByTestId(`day-2026-09-${d}`));
  expect((await day('03')).getByLabelText('sunny-outline')).toBeTruthy();
  expect((await day('04')).getByLabelText('add-outline')).toBeTruthy();
  expect((await day('02')).getByText('OT')).toBeTruthy();
});

test('calendar: a half day off shows the sun icon and a named label', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram', joining_date: '2026-09-01' }));
  await upsertLocal(s.db, 'days_off', { id: 'd3', property_id: 'p1', date: '2026-09-02', name: 'Half closure', kind: 'closure', portion: 'half', pay_rule: 'by_basis',
    is_active: 1, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-01T09:00:00Z', server_updated_at: null });
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  const cell = await screen.findByTestId('day-2026-09-02');
  expect(within(cell).getByLabelText('sunny-outline')).toBeTruthy();
  expect(cell.props.accessibilityLabel).toContain('Half closure');
});
