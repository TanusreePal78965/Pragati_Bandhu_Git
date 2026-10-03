import type { Settlement, SettlementSummary } from '../domain/types';

export type PayslipLine = { key: string; params?: Record<string, string | number>; amountPaise?: number; negative?: boolean };
export type PayslipView = { header: { settledOn: string; rateKey: string; ratePaise: number };
  attendance: PayslipLine[]; earnings: PayslipLine[]; deductions: PayslipLine[]; balance: PayslipLine[]; carry: PayslipLine;
  advanceLeft: PayslipLine; voided: boolean };

export function buildPayslipView(s: Settlement, voided: boolean): PayslipView {
  const sum = (s.summary && 'present' in s.summary ? s.summary : null) as SettlementSummary | null;
  const attendance: PayslipLine[] = [];
  if (sum) {
    attendance.push({ key: 'payslip.present', params: { n: sum.present } }, { key: 'payslip.half', params: { n: sum.half } },
      { key: 'payslip.absent', params: { n: sum.absent } });
    if (sum.hoursTotal > 0) attendance.push({ key: 'payslip.hours', params: { n: sum.hoursTotal } });
    if (sum.daysOffPaid > 0 || sum.daysOffUnpaid > 0) {
      attendance.push({ key: 'payslip.daysOff', params: { paid: sum.daysOffPaid, unpaid: sum.daysOffUnpaid } });
    }
    if (sum.offdayWorked > 0) attendance.push({ key: 'payslip.offdayWorked', params: { n: sum.offdayWorked } });
    if (sum.otHours > 0) attendance.push({ key: 'payslip.otHours', params: { n: sum.otHours } });
  }
  const earnings: PayslipLine[] = [{ key: 'payslip.base', amountPaise: s.base_paise }];
  if (s.offday_extra_paise) earnings.push({ key: 'payslip.offdayExtra', amountPaise: s.offday_extra_paise });
  if (s.overtime_paise) earnings.push({ key: 'payslip.overtime', amountPaise: s.overtime_paise });
  if (s.bonus_paise) earnings.push({ key: 'payslip.bonus', amountPaise: s.bonus_paise });
  const deductions: PayslipLine[] = [];
  if (s.deduction_paise > 0) deductions.push({ key: 'payslip.deduction', amountPaise: s.deduction_paise, negative: true });
  if (s.advance_recovered_paise > 0) deductions.push({ key: 'payslip.advanceRecovered', amountPaise: s.advance_recovered_paise, negative: true });
  const carry: PayslipLine = s.closing_balance_paise > 0 ? { key: 'payslip.carryOwed', amountPaise: s.closing_balance_paise }
    : s.closing_balance_paise < 0 ? { key: 'payslip.carryOverpaid', amountPaise: -s.closing_balance_paise }
      : { key: 'payslip.carryClear' };
  return {
    header: { settledOn: s.settled_on,
      rateKey: `payBasis.${s.pay_basis}`, ratePaise: s.rate_paise },
    attendance, earnings, deductions,
    balance: [
      { key: 'payslip.opening', amountPaise: s.opening_balance_paise },
      { key: 'payslip.paidInPeriod', amountPaise: s.paid_in_period_paise },
      { key: 'payslip.paidNow', amountPaise: s.paid_now_paise },
    ],
    carry, advanceLeft: { key: 'payslip.advanceLeft', amountPaise: s.advance_after_paise }, voided,
  };
}
