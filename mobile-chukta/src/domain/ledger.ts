import { addDays, compareDates, daysInMonth } from '../utils/dates';
import { activeMoneyRows, effectiveAttendance } from './attendance';
import { baseCredit, classifyDay, dayCredit, dayRatePaise } from './dayClass';
import { effectiveDaysOff, latestByDate } from './latest';
import type {
  AdvanceEntry, AttendanceEntry, DayOff, EarningAdjustment, ExplanationLine, LedgerResult, OvertimeEntry, ResolvedSettings, WagePayment,
} from './types';

export { dayCredit } from './dayClass';

type Input = {
  settings: ResolvedSettings;
  ratePaise: number;
  joiningDate: string;
  leftDate: string | null;
  today: string;
  attendance: AttendanceEntry[];
  advances: AdvanceEntry[];
  payments: WagePayment[];
  daysOff?: DayOff[];
  overtime?: OvertimeEntry[];
  adjustments?: EarningAdjustment[];
};

const round2 = (x: number) => Math.round(x * 100) / 100;
const toPaise = (x: number) => Math.round(x + 1e-6);

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

export function calculateWorkerLedger(input: Input): LedgerResult {
  const { settings: s, ratePaise: rate } = input;
  const shift = s.shiftHours > 0 ? s.shiftHours : 8;
  const end = input.leftDate && compareDates(input.leftDate, input.today) < 0 ? input.leftDate : input.today;
  const dates = compareDates(input.joiningDate, end) <= 0 ? eachDate(input.joiningDate, end) : [];
  const byDate = effectiveAttendance(input.attendance);
  const offByDate = effectiveDaysOff(input.daysOff ?? []);

  const explanation: ExplanationLine[] = [];
  let paidOff = 0;
  let unpaidOff = 0;
  const credits = new Map<string, number>();
  const weeklyOffDates = new Set<string>();
  for (const d of dates) {
    const cls = classifyDay(d, s, offByDate.get(d));
    credits.set(d, baseCredit(cls, byDate.get(d), shift));
    if (cls.kind === 'off' && cls.weekly) weeklyOffDates.add(d);
    if (cls.kind === 'off' && cls.dayOff) {
      const size = cls.portion === 'half' ? 0.5 : 1;
      if (cls.paid) paidOff += size; else unpaidOff += size;
    }
  }

  let base = 0;
  if (s.payBasis === 'hourly') {
    let hours = 0;
    for (const d of dates) hours += (credits.get(d) ?? 0) * shift;
    base = hours * rate;
    explanation.push({ key: 'ledger.explain.hourly', params: { hours: round2(hours), rate } });
  } else if (s.payBasis === 'daily') {
    let days = 0;
    for (const d of dates) days += credits.get(d) ?? 0;
    base = days * rate;
    explanation.push({ key: 'ledger.explain.daily', params: { days: round2(days), rate } });
  } else if (s.payBasis === 'weekly') {
    let days = 0;
    for (const d of dates) days += credits.get(d) ?? 0;
    base = (days * rate) / 7;
    explanation.push({ key: 'ledger.explain.weekly', params: { days: round2(days), rate } });
  } else {
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
      // Divisor 26 counts working days only: weekly offs excluded, as in Phase 1 (holidays still count).
      const eligible = s.monthlyDivisor === '26' ? monthDates.filter((d) => !weeklyOffDates.has(d)).length : monthDates.length;
      const baseAmount = whole ? rate : Math.min(rate, (eligible * rate) / divisor);
      let deductionDays = 0;
      for (const d of monthDates) deductionDays += 1 - (credits.get(d) ?? 0);
      base += Math.max(0, baseAmount - (deductionDays * rate) / divisor);
      explanation.push({
        key: whole ? 'ledger.explain.monthly' : 'ledger.explain.monthlyPartial',
        params: { month, base: Math.round(baseAmount), deductionDays: round2(deductionDays), perDay: Math.round(perDay), divisor, eligibleDays: eligible },
      });
    }
  }
  if (paidOff > 0) explanation.push({ key: 'ledger.explain.daysOffPaid', params: { days: round2(paidOff) } });
  if (unpaidOff > 0) explanation.push({ key: 'ledger.explain.daysOffUnpaid', params: { days: round2(unpaidOff) } });

  const otByDate = latestByDate(input.overtime ?? []);
  let offdayExtra = 0;
  let offdayDays = 0;
  let otPay = 0;
  let otHoursTotal = 0;
  for (const d of dates) {
    const cls = classifyDay(d, s, offByDate.get(d));
    const entry = byDate.get(d);
    const dayRate = dayRatePaise(s, rate, d);

    // Work on a full day off: extra on top of any off-pay (spec 5.5). No entry or absent means no work.
    if (cls.kind === 'off' && cls.portion === 'full' && entry && entry.status !== 'absent') {
      const workCredit = dayCredit(entry, shift);
      if (entry.custom_amount_paise != null) offdayExtra += entry.custom_amount_paise;
      else offdayExtra += workCredit * dayRate * s.offdayMultiplier;
      offdayDays += workCredit;
    }

    // Overtime (spec 5.7): an explicit entry wins; otherwise hours above the shift.
    const explicit = otByDate.get(d);
    const autoHours = entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0;
    const otHours = explicit ? explicit.hours : autoHours;
    // An explicit 0-hour entry clears overtime for the date, even with a custom amount (spec 4.2).
    if (otHours > 0) {
      if (explicit?.custom_amount_paise != null) otPay += explicit.custom_amount_paise;
      else if (s.otMode === 'fixed' && s.otRatePaise != null) otPay += otHours * s.otRatePaise;
      else otPay += otHours * (dayRate / shift) * (s.otMode === 'fixed' ? 1 : s.otMultiplier);
      otHoursTotal += otHours;
    }
  }
  const adjustments = activeMoneyRows(input.adjustments ?? []);
  const bonusPaise = adjustments.filter((a) => a.type === 'bonus').reduce((sum, a) => sum + a.amount_paise, 0);
  const deductionPaise = adjustments.filter((a) => a.type === 'deduction').reduce((sum, a) => sum + a.amount_paise, 0);

  const basePaise = toPaise(base);
  const offdayExtraPaise = toPaise(offdayExtra);
  const overtimePaise = toPaise(otPay);
  if (offdayExtraPaise > 0) explanation.push({ key: 'ledger.explain.offdayWork', params: { days: round2(offdayDays), amount: offdayExtraPaise } });
  if (overtimePaise > 0) explanation.push({ key: 'ledger.explain.overtime', params: { hours: round2(otHoursTotal), amount: overtimePaise } });
  if (bonusPaise > 0) explanation.push({ key: 'ledger.explain.bonus', params: { amount: bonusPaise } });
  if (deductionPaise > 0) explanation.push({ key: 'ledger.explain.deduction', params: { amount: deductionPaise } });

  const earnedPaise = basePaise + offdayExtraPaise + overtimePaise + bonusPaise - deductionPaise;
  const paidPaise = activeMoneyRows(input.payments).reduce((sum, p) => sum + p.amount_paise, 0);
  const advanceOutstandingPaise = activeMoneyRows(input.advances).reduce(
    (sum, a) => sum + (a.type === 'advance' ? a.amount_paise : -a.amount_paise), 0);

  return {
    earnedPaise, paidPaise, wageDuePaise: earnedPaise - paidPaise, advanceOutstandingPaise, explanation,
    basePaise, offdayExtraPaise, overtimePaise, bonusPaise, deductionPaise,
  };
}
