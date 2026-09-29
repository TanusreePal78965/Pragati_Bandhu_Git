import { addDays, compareDates, daysInMonth, weekday } from '../utils/dates';
import { activeMoneyRows, effectiveAttendance } from './attendance';
import type { AdvanceEntry, AttendanceEntry, ExplanationLine, LedgerResult, ResolvedSettings, WagePayment } from './types';

type Input = {
  settings: ResolvedSettings;
  ratePaise: number;
  joiningDate: string;
  leftDate: string | null;
  today: string;
  attendance: AttendanceEntry[];
  advances: AdvanceEntry[];
  payments: WagePayment[];
};

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Day credit for a working day: no entry → 1; absent 0; half 0.5; hours → min(h / shift, 1). */
function credit(entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (!entry || entry.status === 'present') return 1;
  if (entry.status === 'absent') return 0;
  if (entry.status === 'half_day') return 0.5;
  return Math.min((entry.hours ?? 0) / shiftHours, 1);
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

export function calculateWorkerLedger(input: Input): LedgerResult {
  const { settings: s, ratePaise: rate } = input;
  const end = input.leftDate && compareDates(input.leftDate, input.today) < 0 ? input.leftDate : input.today;
  const dates = compareDates(input.joiningDate, end) <= 0 ? eachDate(input.joiningDate, end) : [];
  const byDate = effectiveAttendance(input.attendance);
  const isOff = (d: string) => s.weeklyOff !== null && weekday(d) === s.weeklyOff;

  let earned = 0;
  const explanation: ExplanationLine[] = [];

  if (s.payBasis === 'hourly') {
    let hours = 0;
    for (const d of dates) {
      if (isOff(d)) continue;
      hours += credit(byDate.get(d), s.shiftHours) * s.shiftHours;
    }
    earned = hours * rate;
    explanation.push({ key: 'ledger.explain.hourly', params: { hours: round2(hours), rate } });
  } else if (s.payBasis === 'daily') {
    let days = 0;
    for (const d of dates) if (!isOff(d)) days += credit(byDate.get(d), s.shiftHours);
    earned = days * rate;
    explanation.push({ key: 'ledger.explain.daily', params: { days: round2(days), rate } });
  } else if (s.payBasis === 'weekly') {
    let days = 0;
    for (const d of dates) days += isOff(d) ? 1 : credit(byDate.get(d), s.shiftHours);
    earned = (days * rate) / 7;
    explanation.push({ key: 'ledger.explain.weekly', params: { days: round2(days), rate } });
  } else {
    // monthly: per calendar month overlapping the period
    const months = new Map<string, string[]>();
    for (const d of dates) {
      const key = d.slice(0, 7);
      const list = months.get(key) ?? [];
      list.push(d);
      months.set(key, list);
    }
    for (const [month, monthDates] of months) {
      const [y, m] = month.split('-').map(Number);
      const dim = daysInMonth(y, m);
      const divisor = s.monthlyDivisor === 'calendar' ? dim : Number(s.monthlyDivisor);
      const perDay = rate / divisor;
      const whole = monthDates.length === dim;
      const workingDates = monthDates.filter((d) => !isOff(d));
      const eligible = s.monthlyDivisor === '26' ? workingDates.length : monthDates.length;
      const baseAmount = whole ? rate : Math.min(rate, eligible * perDay);
      let deductionDays = 0;
      for (const d of workingDates) deductionDays += 1 - credit(byDate.get(d), s.shiftHours);
      earned += Math.max(0, baseAmount - deductionDays * perDay);
      explanation.push({
        key: 'ledger.explain.monthly',
        params: { month, base: Math.round(baseAmount), deductionDays: round2(deductionDays), perDay: Math.round(perDay) },
      });
    }
  }

  const earnedPaise = Math.round(earned);
  const paidPaise = activeMoneyRows(input.payments).reduce((sum, p) => sum + p.amount_paise, 0);
  const advanceOutstandingPaise = activeMoneyRows(input.advances).reduce(
    (sum, a) => sum + (a.type === 'advance' ? a.amount_paise : -a.amount_paise), 0);

  return { earnedPaise, paidPaise, wageDuePaise: earnedPaise - paidPaise, advanceOutstandingPaise, explanation };
}
