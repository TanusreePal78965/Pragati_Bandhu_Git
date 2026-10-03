import { isDue, nextPeriod, periodFrom } from '../domain/cycles';

const W = { payCycle: 'weekly' as const, cycleEndWeekday: 6 };   // weeks end Saturday
const M = { payCycle: 'monthly' as const, cycleEndWeekday: 6 };

test('periodFrom: weekly ends on the next cycle-end weekday (2026-09-05 is a Saturday)', () => {
  expect(periodFrom('2026-09-01', W)).toEqual({ start: '2026-09-01', end: '2026-09-05' });
  expect(periodFrom('2026-09-05', W)).toEqual({ start: '2026-09-05', end: '2026-09-05' });
  expect(periodFrom('2026-09-06', W)).toEqual({ start: '2026-09-06', end: '2026-09-12' });
  expect(periodFrom('2026-09-03', { payCycle: 'weekly', cycleEndWeekday: 3 })).toEqual({ start: '2026-09-03', end: '2026-09-09' });
});

test('periodFrom: monthly ends on the last day of the start month, crossing a weekly-span month boundary is fine', () => {
  expect(periodFrom('2026-09-01', M)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  expect(periodFrom('2026-09-15', M)).toEqual({ start: '2026-09-15', end: '2026-09-30' });
  expect(periodFrom('2026-02-01', M)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  expect(periodFrom('2026-09-27', W)).toEqual({ start: '2026-09-27', end: '2026-10-03' });
});

test('nextPeriod: starts on joining, then the day after the last settlement; cut to the leaving date', () => {
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: null, lastSettledEnd: null, settings: W, today: '2026-09-06' }))
    .toEqual({ start: '2026-09-02', end: '2026-09-05' });
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: null, lastSettledEnd: '2026-09-05', settings: W, today: '2026-09-20' }))
    .toEqual({ start: '2026-09-06', end: '2026-09-12' });
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: '2026-09-09', lastSettledEnd: '2026-09-05', settings: W, today: '2026-09-20' }))
    .toEqual({ start: '2026-09-06', end: '2026-09-09' });
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: '2026-09-09', lastSettledEnd: '2026-09-09', settings: W, today: '2026-09-20' })).toBeNull();
});

test('nextPeriod: a cycle change applies from the next start (weekly → monthly on the 10th)', () => {
  expect(nextPeriod({ joiningDate: '2026-09-01', leftDate: null, lastSettledEnd: '2026-09-09', settings: M, today: '2026-10-20' }))
    .toEqual({ start: '2026-09-10', end: '2026-09-30' });
});

test('nextPeriod: with no settlement the first period catches up from joining to the last period that ended before today', () => {
  // 2026-05-01 is a Friday; weeks end Saturday. 2026-09-26 is the last Saturday before 2026-10-03; the week ending 10-03 has not ended on 10-03.
  const first = nextPeriod({ joiningDate: '2026-05-01', leftDate: null, lastSettledEnd: null, settings: W, today: '2026-10-03' });
  expect(first).toEqual({ start: '2026-05-01', end: '2026-09-26' });
  expect(isDue(first!, '2026-10-03')).toBe(true);
  const next = nextPeriod({ joiningDate: '2026-05-01', leftDate: null, lastSettledEnd: '2026-09-26', settings: W, today: '2026-10-03' });
  expect(next).toEqual({ start: '2026-09-27', end: '2026-10-03' });
  expect(isDue(next!, '2026-10-03')).toBe(false);
  expect(isDue(next!, '2026-10-04')).toBe(true);
});

test('nextPeriod: catch-up for monthly, a recent joiner, and a worker who left', () => {
  expect(nextPeriod({ joiningDate: '2026-05-15', leftDate: null, lastSettledEnd: null, settings: M, today: '2026-10-03' }))
    .toEqual({ start: '2026-05-15', end: '2026-09-30' });
  // Joined Thursday 10-01: the joining week (ends Saturday 10-03) has not ended, so it is the normal period, not due.
  const recent = nextPeriod({ joiningDate: '2026-10-01', leftDate: null, lastSettledEnd: null, settings: W, today: '2026-10-03' });
  expect(recent).toEqual({ start: '2026-10-01', end: '2026-10-03' });
  expect(isDue(recent!, '2026-10-03')).toBe(false);
  expect(nextPeriod({ joiningDate: '2026-05-01', leftDate: '2026-08-10', lastSettledEnd: null, settings: W, today: '2026-10-03' }))
    .toEqual({ start: '2026-05-01', end: '2026-08-10' });
});

test('isDue: only after the period ends (or on/after the leaving-date end)', () => {
  const p = { start: '2026-09-06', end: '2026-09-12' };
  expect(isDue(p, '2026-09-12')).toBe(false);
  expect(isDue(p, '2026-09-13')).toBe(true);
  expect(isDue({ start: '2026-09-06', end: '2026-09-09' }, '2026-09-09')).toBe(false);
});
