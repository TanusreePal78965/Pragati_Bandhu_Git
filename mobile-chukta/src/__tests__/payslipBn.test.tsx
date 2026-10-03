import { screen } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import { settleWorker } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { PayslipScreen } from '../screens/PayslipScreen';
import { property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen } from './helpers/session';

beforeAll(() => initI18n('bn'));

test('the payslip period uses Bengali month names, not English ones', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ joining_date: '2026-08-30' }));
  const st = await settleWorker(s.repo, { worker: worker({ joining_date: '2026-08-30' }), property: property(), today: '2026-09-07',
    periodStart: '2026-08-30', paidNowPaise: 250000, recoveredPaise: 0, mode: 'cash' });
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  // Same shape as English "30 Aug–5 Sep", with Bengali short month names (the app does not localise digits).
  expect(await screen.findByText('30 আগ–5 সেপ্টে')).toBeTruthy();
});
