import { addDays, compareDates } from '../utils/dates';
import { effectiveAttendance } from './attendance';
import type { Period } from './cycles';
import { classifyDay, dayCredit } from './dayClass';
import { calculateWorkerLedger } from './ledger';
import { effectiveDaysOff, latestByDate } from './latest';
import type {
  AdvanceEntry, AttendanceEntry, DayOff, EarningAdjustment, LedgerResult, OvertimeEntry, PayBasis, ResolvedSettings, SettlementSummary, WagePayment, Worker,
} from './types';

export type LedgerData = { attendance: AttendanceEntry[]; advances: AdvanceEntry[]; payments: WagePayment[];
  daysOff: DayOff[]; overtime: OvertimeEntry[]; adjustments: EarningAdjustment[] };

export type SettlementDraft = {
  period: Period; payBasis: PayBasis; ratePaise: number; openingBalancePaise: number;
  basePaise: number; offdayExtraPaise: number; overtimePaise: number; bonusPaise: number; deductionPaise: number;
  earnedPaise: number; paidInPeriodPaise: number; wageDuePaise: number; advanceOutstandingPaise: number;
  suggestedRecoveryPaise: number; suggestedPaidNowPaise: number; summary: SettlementSummary;
  /** Closing of the latest active settlement before this period, or null when there is none. */
  previousClosingPaise: number | null;
};

const r2 = (x: number) => Math.round(x * 100) / 100;

const ZERO: LedgerResult = {
  earnedPaise: 0, paidPaise: 0, wageDuePaise: 0, advanceOutstandingPaise: 0, explanation: [],
  basePaise: 0, offdayExtraPaise: 0, overtimePaise: 0, bonusPaise: 0, deductionPaise: 0,
};

export function buildSettlementDraft(input: {
  worker: Worker; settings: ResolvedSettings; period: Period; data: LedgerData; previousClosingPaise?: number | null;
}): SettlementDraft {
  const { worker, settings: s, period, data } = input;
  const ledger = (from: string, to: string) => calculateWorkerLedger({
    settings: s, ratePaise: worker.rate_paise, joiningDate: worker.joining_date, leftDate: worker.left_date,
    today: to, window: { from, to }, ...data,
  });
  // Cumulative differences, so per-window rounding never drifts between chained periods.
  const cumE = ledger(worker.joining_date, period.end);
  const cumS = period.start === worker.joining_date ? ZERO : ledger(worker.joining_date, addDays(period.start, -1));
  const wageDue = cumE.wageDuePaise;
  const outstanding = cumE.advanceOutstandingPaise;
  const recovery = Math.max(0, Math.min(outstanding, Math.max(wageDue, 0)));
  return {
    period, payBasis: s.payBasis, ratePaise: worker.rate_paise, openingBalancePaise: cumS.wageDuePaise,
    basePaise: cumE.basePaise - cumS.basePaise,
    offdayExtraPaise: cumE.offdayExtraPaise - cumS.offdayExtraPaise,
    overtimePaise: cumE.overtimePaise - cumS.overtimePaise,
    bonusPaise: cumE.bonusPaise - cumS.bonusPaise,
    deductionPaise: cumE.deductionPaise - cumS.deductionPaise,
    earnedPaise: cumE.earnedPaise - cumS.earnedPaise,
    paidInPeriodPaise: cumE.paidPaise - cumS.paidPaise, wageDuePaise: wageDue, advanceOutstandingPaise: outstanding,
    suggestedRecoveryPaise: recovery, suggestedPaidNowPaise: Math.max(wageDue - recovery, 0),
    summary: { ...summarise(worker, s, period, data), explanation: ledger(period.start, period.end).explanation },
    previousClosingPaise: input.previousClosingPaise ?? null,
  };
}

function summarise(worker: Worker, s: ResolvedSettings, period: Period, data: LedgerData): Omit<SettlementSummary, 'explanation'> {
  const shift = s.shiftHours > 0 ? s.shiftHours : 8;
  const byDate = effectiveAttendance(data.attendance);
  const offByDate = effectiveDaysOff(data.daysOff);
  const otByDate = latestByDate(data.overtime);
  const out = { present: 0, half: 0, absent: 0, hoursTotal: 0, daysOffPaid: 0, daysOffUnpaid: 0, offdayWorked: 0, otHours: 0 };
  const from = compareDates(period.start, worker.joining_date) > 0 ? period.start : worker.joining_date;
  const to = worker.left_date && compareDates(worker.left_date, period.end) < 0 ? worker.left_date : period.end;
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) {
    const cls = classifyDay(d, s, offByDate.get(d));
    const entry = byDate.get(d);
    const fullOff = cls.kind === 'off' && cls.portion === 'full';
    if (cls.kind === 'off' && cls.dayOff) {
      const size = cls.portion === 'half' ? 0.5 : 1;
      if (cls.paid) out.daysOffPaid += size; else out.daysOffUnpaid += size;
    }
    if (fullOff) {
      if (entry && entry.status !== 'absent') out.offdayWorked += dayCredit(entry, shift);
    } else if (entry?.status === 'absent') out.absent += 1;
    else if (entry?.status === 'half_day') out.half += 1;
    else if (entry?.status === 'hours') out.hoursTotal += entry.hours ?? 0;
    else out.present += 1;
    const explicit = otByDate.get(d);
    const auto = entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0;
    out.otHours += explicit ? explicit.hours : auto;
  }
  return { ...out, hoursTotal: r2(out.hoursTotal), offdayWorked: r2(out.offdayWorked), otHours: r2(out.otHours) };
}

export function closingBalance(d: SettlementDraft, paidNowPaise: number, recoveredPaise: number): number {
  return d.wageDuePaise - recoveredPaise - paidNowPaise;
}
