import { effectiveAttendance } from '../domain/attendance';
import { dayCredit } from '../domain/ledger';
import type { AttendanceEntry, ResolvedSettings } from '../domain/types';
import { compareDates, daysInMonth, weekday } from '../utils/dates';

export type DayKind = 'outside' | 'future' | 'off' | 'working';
export type DayCell = { date: string; day: number; kind: DayKind; entry: AttendanceEntry | null; credit: number | null };
export type MonthGrid = { year: number; month: number; leadingBlanks: number; cells: DayCell[] };

const pad = (n: number) => n.toString().padStart(2, '0');

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Sunday-first calendar for one worker and month. Credit uses the same rule as the wage calculation. */
export function buildMonthGrid(i: {
  year: number; month: number; settings: ResolvedSettings; joiningDate: string; leftDate: string | null; today: string; attendance: AttendanceEntry[];
}): MonthGrid {
  const byDate = effectiveAttendance(i.attendance);
  const shift = i.settings.shiftHours > 0 ? i.settings.shiftHours : 8;
  const cells: DayCell[] = [];
  for (let d = 1; d <= daysInMonth(i.year, i.month); d++) {
    const date = `${i.year}-${pad(i.month)}-${pad(d)}`;
    let kind: DayKind;
    if (compareDates(date, i.joiningDate) < 0 || (i.leftDate !== null && compareDates(date, i.leftDate) > 0)) kind = 'outside';
    else if (compareDates(date, i.today) > 0) kind = 'future';
    else if (i.settings.weeklyOff !== null && weekday(date) === i.settings.weeklyOff) kind = 'off';
    else kind = 'working';
    const entry = kind === 'working' ? byDate.get(date) ?? null : null;
    cells.push({ date, day: d, kind, entry, credit: kind === 'working' ? dayCredit(entry ?? undefined, shift) : null });
  }
  return { year: i.year, month: i.month, leadingBlanks: weekday(`${i.year}-${pad(i.month)}-01`), cells };
}
