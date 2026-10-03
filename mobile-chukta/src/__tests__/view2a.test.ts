import type { DayOff, EarningAdjustment, OvertimeEntry } from '../domain/types';
import { resolveSettings } from '../domain/settings';
import { buildMoneyHistory } from '../view/moneyHistory';
import { buildMonthGrid } from '../view/monthGrid';
import { buildTodayRows, effectiveDayOffFor } from '../view/today';
import { adv, att, property, worker } from './helpers/fixtures';

const off = (date: string, over: Partial<DayOff> = {}): DayOff => ({
  id: `d-${date}`, property_id: 'p1', date, name: 'Holi', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', is_active: 1,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T09:00:00Z`, server_updated_at: null, ...over,
});
const ot = (date: string, hours: number): OvertimeEntry => ({
  id: `o-${date}`, property_id: 'p1', worker_id: 'w1', date, hours, custom_amount_paise: null, note: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T18:00:00Z`, server_updated_at: null,
});

test('today rows: a holiday makes the day a full day off; half closure is not "off"; overtime is attached', () => {
  const rows = buildTodayRows([worker()], property(), [], '2026-09-08', [off('2026-09-08')], [ot('2026-09-08', 2)]);
  expect(rows[0].isOff).toBe(true);
  expect(rows[0].overtime?.hours).toBe(2);
  const half = buildTodayRows([worker()], property(), [], '2026-09-08', [off('2026-09-08', { portion: 'half', kind: 'closure' })]);
  expect(half[0].isOff).toBe(false);
  expect(half[0].dayClass).toMatchObject({ kind: 'off', portion: 'half' });
  expect(effectiveDayOffFor([off('2026-09-08', { is_active: 0 })], '2026-09-08')).toBeNull();
});

test('today rows: by-hours entries above the shift report automatic overtime', () => {
  const rows = buildTodayRows([worker({ pay_basis: 'hourly' })], property(), [att('2026-09-08', 'hours', { hours: 10 })], '2026-09-08');
  expect(rows[0].autoOtHours).toBe(2);
});

test('month grid marks holidays, half closures, work on a day off and overtime', () => {
  const g = buildMonthGrid({
    year: 2026, month: 9, settings: resolveSettings(worker(), property()), joiningDate: '2026-09-01', leftDate: null, today: '2026-09-30',
    attendance: [att('2026-09-06', 'present')], daysOff: [off('2026-09-10'), off('2026-09-11', { kind: 'closure', portion: 'half' })],
    overtime: [ot('2026-09-12', 2)],
  });
  const cell = (d: number) => g.cells[d - 1];
  expect(cell(6)).toMatchObject({ kind: 'off', workedOnOff: true });
  expect(cell(10)).toMatchObject({ kind: 'off', dayOff: expect.objectContaining({ name: 'Holi' }) });
  expect(cell(11)).toMatchObject({ kind: 'working', halfOff: true, credit: 0.5 });
  expect(cell(12).otHours).toBe(2);
});

test('money history includes bonuses and deductions and their voids', () => {
  const adjustment = (id: string, type: EarningAdjustment['type'], voids: string | null = null): EarningAdjustment => ({
    id, property_id: 'p1', worker_id: 'w1', type, amount_paise: 10000, date: '2026-09-05', note: 'x', voids_id: voids,
    created_by: 'u1', created_by_role: 'owner', created_at: `2026-09-05T1${id.length}:00:00Z`, server_updated_at: null,
  });
  const items = buildMoneyHistory([adv('a1')], [], [adjustment('b1', 'bonus'), adjustment('dd1', 'deduction'), adjustment('vvv1', 'bonus', 'b1')]);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  expect(byId.b1).toMatchObject({ kind: 'bonus', table: 'earning_adjustments', isVoided: true, canCorrect: false, mode: null });
  expect(byId.dd1).toMatchObject({ kind: 'deduction', canCorrect: true });
  expect(byId.vvv1).toMatchObject({ isVoid: true });
});
