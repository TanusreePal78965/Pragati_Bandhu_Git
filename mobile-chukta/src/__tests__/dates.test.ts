import { addDays, compareDates, daysInMonth, todayLocal, weekday } from '../utils/dates';

test('todayLocal uses local calendar parts, not UTC', () => {
  // 00:30 on 1 Sep in local time must be 2026-09-01 regardless of UTC offset
  expect(todayLocal(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
});

test('date arithmetic on YYYY-MM-DD strings', () => {
  expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(weekday('2026-09-06')).toBe(0); // Sunday
  expect(weekday('2026-09-01')).toBe(2); // Tuesday
  expect(daysInMonth(2026, 2)).toBe(28);
  expect(daysInMonth(2028, 2)).toBe(29);
  expect(compareDates('2026-09-01', '2026-09-02')).toBeLessThan(0);
});
