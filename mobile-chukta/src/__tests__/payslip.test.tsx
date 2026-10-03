import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { initI18n } from '../i18n';
import { settleWorker, unlockSettlement } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { PayslipScreen } from '../screens/PayslipScreen';
import { property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));
beforeEach(() => jest.clearAllMocks());

async function settled(identity = OWNER) {
  const owner = await makeSession(OWNER);
  await upsertLocal(owner.db, 'properties', property());
  await upsertLocal(owner.db, 'workers', worker({ joining_date: '2026-08-30' }));
  const st = await settleWorker(owner.repo, { worker: worker({ joining_date: '2026-08-30' }), property: property(), today: '2026-09-07',
    periodStart: '2026-08-30', paidNowPaise: 250000, recoveredPaise: 0, mode: 'cash' });
  if (identity === OWNER) return { s: owner, st };
  const staff = await makeSession(STAFF, { db: owner.db });
  return { s: staff, st };
}

test('payslip shows the frozen figures and shares as an image', async () => {
  const { s, st } = await settled();
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  expect(await screen.findByText('30 Aug–5 Sep')).toBeTruthy();
  expect(screen.getByText('Present: 6')).toBeTruthy();
  expect(screen.getByText('Carried forward: ₹500 still to pay')).toBeTruthy();
  expect(screen.getByText('Settled on 7 Sep 2026')).toBeTruthy();
  fireEvent.press(screen.getByTestId('payslip-share'));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/payslip.png', expect.anything()));
  expect(captureRef).toHaveBeenCalled();
});

test('an overpaid carried-in reads as overpaid, not a negative amount', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  const w = worker({ joining_date: '2026-08-23' });
  await upsertLocal(s.db, 'workers', w);
  // 23–29 Aug earns 6 × ₹500 = ₹3000; paying ₹4000 leaves ₹1000 overpaid, carried into 30 Aug–5 Sep.
  await settleWorker(s.repo, { worker: w, property: property(), today: '2026-08-30', periodStart: '2026-08-23', paidNowPaise: 400000,
    recoveredPaise: 0, mode: 'cash' });
  const st = await settleWorker(s.repo, { worker: w, property: property(), today: '2026-09-07', periodStart: '2026-08-30', paidNowPaise: 0,
    recoveredPaise: 0, mode: null });
  expect(st.opening_balance_paise).toBe(-100000);
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  expect(await screen.findByText('Carried in: overpaid ₹1,000')).toBeTruthy();
  expect(screen.queryByText(/−₹1,000/)).toBeNull();
});

test('owner unlocks after confirming; the slip then shows Unlocked', async () => {
  const { s, st } = await settled();
  const alert = jest.spyOn(Alert, 'alert');
  try {
    renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
    fireEvent.press(await screen.findByTestId('payslip-unlock'));
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => { buttons[buttons.length - 1].onPress!(); });
    expect(await screen.findByText('Unlocked')).toBeTruthy();
    expect(screen.queryByTestId('payslip-unlock')).toBeNull();
    expect(s.afterWrite).toHaveBeenCalled();
  } finally {
    alert.mockRestore();
  }
});

test('staff can view and share but not unlock', async () => {
  const { s, st } = await settled(STAFF);
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  expect(await screen.findByTestId('payslip-share')).toBeTruthy();
  expect(screen.queryByTestId('payslip-unlock')).toBeNull();
});

test('owner viewing an older active slip is told to unlock the newer one first', async () => {
  const { s, st } = await settled();
  await settleWorker(s.repo, { worker: worker({ joining_date: '2026-08-30' }), property: property(), today: '2026-09-14',
    periodStart: '2026-09-06', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  expect(await screen.findByText('Unlock the newer payslip first.')).toBeTruthy();
  expect(screen.queryByTestId('payslip-unlock')).toBeNull();
});

test('a voided slip shows Unlocked and offers no unlock', async () => {
  const { s, st } = await settled();
  await unlockSettlement(s.repo, st.id, '2026-09-07');
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  expect(await screen.findByText('Unlocked')).toBeTruthy();
  expect(screen.queryByTestId('payslip-unlock')).toBeNull();
});

test('a failed or unavailable share shows an alert', async () => {
  const { s, st } = await settled();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    (captureRef as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
    fireEvent.press(await screen.findByTestId('payslip-share'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save on this phone. Please try again.'));
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('payslip-share'));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
  } finally {
    alert.mockRestore();
  }
});
