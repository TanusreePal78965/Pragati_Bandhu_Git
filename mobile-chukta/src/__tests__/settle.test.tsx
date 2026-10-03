import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { addAdvance } from '../repos/money';
import * as settlements from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { SettleScreen } from '../screens/SettleScreen';
import { property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

// The session's today is 2026-09-07 (Monday). Worker joined 2026-08-30 (Sunday): week 30 Aug–5 Sep is due.
async function seeded(identity = OWNER) {
  const s = await makeSession(identity);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ joining_date: '2026-08-30' }));
  return s;
}

test('owner sees the due week with defaults and a clear preview', async () => {
  const s = await seeded();
  await addAdvance(s.repo, { propertyId: 'p1', workerId: 'w1', type: 'advance', amountPaise: 30000, date: '2026-09-01', mode: 'cash' });
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByText('Ram · 30 Aug–5 Sep')).toBeTruthy();
  expect(screen.getByTestId('settle-recover').props.value).toBe('300');
  expect(screen.getByTestId('settle-paid').props.value).toBe('2700');   // 6 days × ₹500 − ₹300
  expect(screen.getByText('Settled in full')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('settle-paid'), '2500');
  expect(screen.getByText('Will carry forward: ₹200 still to pay')).toBeTruthy();
});

test('settling writes the rows after confirming', async () => {
  const s = await seeded();
  const alert = jest.spyOn(Alert, 'alert');
  try {
    renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
    fireEvent.press(await screen.findByTestId('settle-save'));
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => { buttons[buttons.length - 1].onPress!(); });
    await waitFor(async () => expect(await s.db.getAllAsync('select period_start, period_end, paid_now_paise from settlements'))
      .toEqual([{ period_start: '2026-08-30', period_end: '2026-09-05', paid_now_paise: 300000 }]));
    expect(s.afterWrite).toHaveBeenCalled();
    expect((await screen.findByTestId('current-route')).props.children).toBe('Payslip');
  } finally {
    alert.mockRestore();
  }
});

test('recovering more than the advance is refused', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const s = await seeded();
  await addAdvance(s.repo, { propertyId: 'p1', workerId: 'w1', type: 'advance', amountPaise: 30000, date: '2026-09-01', mode: 'cash' });
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  fireEvent.changeText(await screen.findByTestId('settle-recover'), '500');
  fireEvent.press(screen.getByTestId('settle-save'));
  expect(await screen.findByText('Cannot take back more than the advance.')).toBeTruthy();
  expect(alert).not.toHaveBeenCalled();
  expect(await s.db.getAllAsync('select id from settlements')).toEqual([]);
  // Editing the field clears its error.
  fireEvent.changeText(screen.getByTestId('settle-recover'), '100');
  expect(screen.queryByText('Cannot take back more than the advance.')).toBeNull();
  alert.mockRestore();
});

test('staff cannot settle', async () => {
  const s = await seeded(STAFF);
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByText('Only the owner can do this.')).toBeTruthy();
  expect(screen.queryByTestId('settle-save')).toBeNull();
});

async function confirmSave() {
  const alert = jest.spyOn(Alert, 'alert');
  fireEvent.press(await screen.findByTestId('settle-save'));
  const buttons = alert.mock.calls[0][2]!;
  alert.mockRestore();
  await act(async () => { buttons[buttons.length - 1].onPress!(); });
}

test('a changed period shows the notice and lets the owner try again', async () => {
  const s = await seeded();
  const spy = jest.spyOn(settlements, 'settleWorker').mockRejectedValueOnce(new Error('period changed'));
  try {
    renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
    await confirmSave();
    expect(await screen.findByText('This period changed. Please check the figures again.')).toBeTruthy();
    expect(screen.getByTestId('settle-save').props.accessibilityState.disabled).toBe(false);
  } finally {
    spy.mockRestore();
  }
});

test('a failed save shows the error and re-enables the button', async () => {
  const s = await seeded();
  const spy = jest.spyOn(settlements, 'settleWorker').mockRejectedValueOnce(new Error('disk full'));
  try {
    renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
    await confirmSave();
    expect(await screen.findByText('Could not save on this phone. Please try again.')).toBeTruthy();
    expect(screen.getByTestId('settle-save').props.accessibilityState.disabled).toBe(false);
  } finally {
    spy.mockRestore();
  }
});

test('paying nothing hides the mode and writes no payment', async () => {
  const s = await seeded();
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId('settle-mode-cash')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('settle-paid'), '');
  expect(screen.queryByTestId('settle-mode-cash')).toBeNull();
  await confirmSave();
  await waitFor(async () => expect(await s.db.getAllAsync('select paid_now_paise from settlements')).toEqual([{ paid_now_paise: 0 }]));
  expect(await s.db.getAllAsync('select id from wage_payments')).toEqual([]);
});

async function settledFirstWeek() {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  const w = worker({ joining_date: '2026-08-23' });
  await upsertLocal(s.db, 'workers', w);
  // 23–29 Aug: 6 days (Sun 23 Aug off) × ₹500 = ₹3000, paid ₹2500 → closing ₹500.
  await settlements.settleWorker(s.repo, { worker: w, property: property(), periodStart: '2026-08-23', today: '2026-08-30',
    paidNowPaise: 250000, recoveredPaise: 0, mode: 'cash' });
  return s;
}

test('a changed rate since the last payslip explains the different carried-in amount', async () => {
  const s = await settledFirstWeek();
  // Rate raised to ₹600: carried in is now 6 × ₹600 − ₹2500 = ₹1100, ₹600 more than the payslip's ₹500.
  await upsertLocal(s.db, 'workers', worker({ joining_date: '2026-08-23', rate_paise: 60000 }));
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByText('Ram · 30 Aug–5 Sep')).toBeTruthy();
  expect(screen.getByText('₹1,100')).toBeTruthy();
  expect(screen.getByText('Carried in changed by ₹600 since the last payslip (pay or entries were changed).')).toBeTruthy();
});

test('no carried-in note when the opening matches the last payslip', async () => {
  const s = await settledFirstWeek();
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByText('₹500')).toBeTruthy();
  expect(screen.queryByText(/since the last payslip/)).toBeNull();
});
