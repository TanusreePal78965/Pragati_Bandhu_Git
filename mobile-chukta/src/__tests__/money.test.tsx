import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import * as moneyRepo from '../repos/money';
import { upsertLocal } from '../repos/write';
import { AdvancesScreen } from '../screens/AdvancesScreen';
import { MoneyEntryScreen } from '../screens/MoneyEntryScreen';
import { WorkerDetailScreen } from '../screens/WorkerDetailScreen';
import { adv, property, worker } from './helpers/fixtures';
import { makeSession, renderScreen, STAFF } from './helpers/session';

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
