import { daysInMonth, weekday } from '../utils/dates';
import type { AttendanceEntry, DayOff, DayOffPortion, PayBasis, ResolvedSettings } from './types';

/** Day credit for a working day: no entry → 1; absent 0; half 0.5; hours → min(h / shift, 1). */
export function dayCredit(entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (!entry || entry.status === 'present') return 1;
  if (entry.status === 'absent') return 0;
  if (entry.status === 'half_day') return 0.5;
  return Math.min((entry.hours ?? 0) / shiftHours, 1);
}

export type DayClass =
  | { kind: 'working' }
  | { kind: 'off'; portion: DayOffPortion; paid: boolean; dayOff: DayOff | null; weekly: boolean };

/** Weekly offs and by-basis holidays: monthly and weekly workers are paid; daily and hourly are not. */
export const isPaidByBasis = (basis: PayBasis) => basis === 'monthly' || basis === 'weekly';

export function classifyDay(date: string, s: ResolvedSettings, dayOff: DayOff | undefined): DayClass {
  const weekly = s.weeklyOff !== null && weekday(date) === s.weeklyOff;
  if (!weekly && !dayOff) return { kind: 'working' };
  const byBasis = isPaidByBasis(s.payBasis);
  const weeklyPaid = weekly && byBasis;
  const dayOffPaid = dayOff
    ? dayOff.pay_rule === 'all_paid' ? true : dayOff.pay_rule === 'all_unpaid' ? false : byBasis
    : false;
  // A holiday on the weekly off counts once, as a full day, paid if either rule pays (spec §5.3).
  return {
    kind: 'off', paid: weeklyPaid || dayOffPaid, portion: weekly ? 'full' : (dayOff as DayOff).portion,
    dayOff: dayOff ?? null, weekly,
  };
}

/** Work credit for the open half of a half day off: 0.5 unless absent; hours count up to half a shift. */
function workHalf(entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (!entry || entry.status === 'present' || entry.status === 'half_day') return 0.5;
  if (entry.status === 'absent') return 0;
  return Math.min((entry.hours ?? 0) / shiftHours, 0.5);
}

/** Fraction of a normally paid day this date earns as base pay (0..1). */
export function baseCredit(cls: DayClass, entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (cls.kind === 'working') return dayCredit(entry, shiftHours);
  if (cls.portion === 'full') return cls.paid ? 1 : 0;
  return (cls.paid ? 0.5 : 0) + workHalf(entry, shiftHours);
}

/** One day's pay in paise for the worker's basis (monthly uses that month's divisor). Not rounded. */
export function dayRatePaise(s: ResolvedSettings, ratePaise: number, date: string): number {
  const shift = s.shiftHours > 0 ? s.shiftHours : 8;
  if (s.payBasis === 'daily') return ratePaise;
  if (s.payBasis === 'weekly') return ratePaise / 7;
  if (s.payBasis === 'hourly') return ratePaise * shift;
  const [y, m] = date.split('-').map(Number);
  const divisor = s.monthlyDivisor === 'calendar' ? daysInMonth(y, m) : Number(s.monthlyDivisor);
  return ratePaise / divisor;
}
