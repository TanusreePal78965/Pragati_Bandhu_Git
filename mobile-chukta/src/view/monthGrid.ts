import { effectiveAttendance } from '../domain/attendance';
import { baseCredit, classifyDay } from '../domain/dayClass';
import { effectiveDaysOff, latestByDate } from '../domain/latest';
import type { AttendanceEntry, DayOff, OvertimeEntry, ResolvedSettings } from '../domain/types';
import { compareDates, daysInMonth, weekday } from '../utils/dates';

export type DayKind = 'outside' | 'future' | 'off' | 'working';
export type DayCell = {
  date: string; day: number; kind: DayKind; entry: AttendanceEntry | null; credit: number | null;
  dayOff: DayOff | null; halfOff: boolean; workedOnOff: boolean; otHours: number;
};
export type MonthGrid = { year: number; month: number; leadingBlanks: number; cells: DayCell[] };

const pad = (n: number) => n.toString().padStart(2, '0');

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Sunday-first calendar for one worker and month. Credit uses the same rule as the wage calculation. */
export function buildMonthGrid(i: {
  year: number; month: number; settings: ResolvedSettings; joiningDate: string; leftDate: string | null; today: string; attendance: AttendanceEntry[];
  daysOff?: DayOff[]; overtime?: OvertimeEntry[];
}): MonthGrid {
  const byDate = effectiveAttendance(i.attendance);
  const offByDate = effectiveDaysOff(i.daysOff ?? []);
  const otByDate = latestByDate(i.overtime ?? []);
  const shift = i.settings.shiftHours > 0 ? i.settings.shiftHours : 8;
  const cells: DayCell[] = [];
  for (let d = 1; d <= daysInMonth(i.year, i.month); d++) {
    const date = `${i.year}-${pad(i.month)}-${pad(d)}`;
    const cls = classifyDay(date, i.settings, offByDate.get(date));
    let kind: DayKind;
    if (compareDates(date, i.joiningDate) < 0 || (i.leftDate !== null && compareDates(date, i.leftDate) > 0)) kind = 'outside';
    else if (compareDates(date, i.today) > 0) kind = 'future';
    else if (cls.kind === 'off' && cls.portion === 'full') kind = 'off';
    else kind = 'working';
    const entry = byDate.get(date) ?? null;
    const isFullOff = kind === 'off';
    const autoOt = entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0;
    const explicitOt = otByDate.get(date);
    cells.push({
      date, day: d, kind,
      entry: kind === 'working' || isFullOff ? entry : null,
      credit: kind === 'working' ? baseCredit(cls, entry ?? undefined, shift) : null,
      dayOff: cls.kind === 'off' ? cls.dayOff : null,
      halfOff: cls.kind === 'off' && cls.portion === 'half',
      workedOnOff: isFullOff && !!entry && entry.status !== 'absent',
      otHours: kind === 'outside' || kind === 'future' ? 0 : explicitOt ? explicitOt.hours : autoOt,
    });
  }
  return { year: i.year, month: i.month, leadingBlanks: weekday(`${i.year}-${pad(i.month)}-01`), cells };
}
