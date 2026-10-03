import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { initI18n } from '../i18n';
import { settleWorker } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { PayslipScreen } from '../screens/PayslipScreen';
import { property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

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
