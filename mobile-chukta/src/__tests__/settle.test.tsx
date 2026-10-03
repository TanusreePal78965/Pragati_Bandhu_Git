import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { addAdvance } from '../repos/money';
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
  } finally {
    alert.mockRestore();
  }
});

test('recovering more than the advance is refused', async () => {
  const s = await seeded();
  await addAdvance(s.repo, { propertyId: 'p1', workerId: 'w1', type: 'advance', amountPaise: 30000, date: '2026-09-01', mode: 'cash' });
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  fireEvent.changeText(await screen.findByTestId('settle-recover'), '500');
  fireEvent.press(screen.getByTestId('settle-save'));
  expect(await screen.findByText('Cannot take back more than the advance.')).toBeTruthy();
});

test('staff cannot settle', async () => {
  const s = await seeded(STAFF);
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByText('Only the owner can do this.')).toBeTruthy();
  expect(screen.queryByTestId('settle-save')).toBeNull();
});
