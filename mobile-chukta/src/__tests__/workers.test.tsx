import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
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
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId('due')).toHaveTextContent('₹2,000');
  fireEvent.press(screen.getByTestId('explain-toggle'));
  expect(screen.getByText('5 days × ₹500')).toBeTruthy();
  expect(screen.getByTestId('day-2026-09-03').props.accessibilityLabel).toMatch(/Absent/);
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
