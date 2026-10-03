export type PayBasis = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type AttendanceMode = 'day' | 'hours';
export type MonthlyDivisor = 'calendar' | '26' | '30';
export type Role = 'owner' | 'staff';
export type PaymentMode = 'cash' | 'upi' | 'bank';

type Audit = { created_by: string; created_by_role: Role; created_at: string; server_updated_at: string | null };

export type OtMode = 'multiplier' | 'fixed';
export type DayOffKind = 'holiday' | 'closure';
export type DayOffPortion = 'full' | 'half';
export type DayOffPayRule = 'by_basis' | 'all_paid' | 'all_unpaid';

export type DayOff = Audit & {
  id: string; property_id: string; date: string; name: string; kind: DayOffKind; portion: DayOffPortion;
  pay_rule: DayOffPayRule; is_active: 0 | 1;
};

export type OvertimeEntry = Audit & {
  id: string; property_id: string; worker_id: string; date: string; hours: number;
  custom_amount_paise: number | null; note: string | null;
};

export type AdjustmentType = 'bonus' | 'deduction';
export type EarningAdjustment = Audit & {
  id: string; property_id: string; worker_id: string; type: AdjustmentType; amount_paise: number; date: string;
  note: string | null; voids_id: string | null;
};

export type PayCycle = 'by_basis' | 'weekly' | 'monthly';

export type Property = {
  id: string; shop_id: string; name: string; address: string | null; is_active: 0 | 1;
  default_pay_basis: PayBasis; default_attendance_mode: AttendanceMode; shift_hours: number;
  weekly_off: number | null; monthly_divisor: MonthlyDivisor; offday_multiplier: number; ot_mode: OtMode; ot_multiplier: number; ot_rate_paise: number | null;
  pay_cycle: PayCycle; cycle_end_weekday: number;
  created_at: string; server_updated_at: string | null;
};

export type StaffUser = {
  id: string; property_id: string; name: string; auth_user_id: string; is_active: 0 | 1;
  created_at: string; server_updated_at: string | null;
};

export type Worker = Audit & {
  id: string; property_id: string; name: string; phone: string | null; pay_basis: PayBasis; rate_paise: number;
  joining_date: string; status: 'active' | 'left'; left_date: string | null;
  attendance_mode: AttendanceMode | null; shift_hours: number | null; weekly_off_override: 0 | 1;
  weekly_off: number | null; monthly_divisor: MonthlyDivisor | null;
  offday_multiplier?: number | null; ot_mode?: OtMode | null; ot_multiplier?: number | null; ot_rate_paise?: number | null;
  pay_cycle?: PayCycle | null; cycle_end_weekday?: number | null;
};

export type AttendanceStatus = 'absent' | 'half_day' | 'present' | 'hours';
export type AttendanceEntry = Audit & {
  id: string; property_id: string; worker_id: string; date: string; status: AttendanceStatus; hours: number | null; note: string | null;
  custom_amount_paise?: number | null;
};

export type AdvanceType = 'advance' | 'repayment' | 'writeoff';
export type AdvanceEntry = Audit & {
  id: string; property_id: string; worker_id: string; type: AdvanceType; amount_paise: number; date: string;
  mode: PaymentMode | null; note: string | null; voids_id: string | null; settlement_id?: string | null;
};

export type WagePayment = Audit & {
  id: string; property_id: string; worker_id: string; amount_paise: number; date: string;
  mode: PaymentMode | null; note: string | null; voids_id: string | null; settlement_id?: string | null;
};

export type ResolvedSettings = {
  payBasis: PayBasis; attendanceMode: AttendanceMode; shiftHours: number; weeklyOff: number | null; monthlyDivisor: MonthlyDivisor;
  offdayMultiplier: number; otMode: OtMode; otMultiplier: number; otRatePaise: number | null;
  payCycle: 'weekly' | 'monthly'; cycleEndWeekday: number;
};

export type ExplanationLine = { key: string; params: Record<string, string | number> };

export type LedgerResult = {
  earnedPaise: number; paidPaise: number; wageDuePaise: number; advanceOutstandingPaise: number; explanation: ExplanationLine[];
  basePaise: number; offdayExtraPaise: number; overtimePaise: number; bonusPaise: number; deductionPaise: number;
};

export type SettlementSummary = {
  present: number; half: number; absent: number; hoursTotal: number;
  daysOffPaid: number; daysOffUnpaid: number; offdayWorked: number; otHours: number;
  explanation: ExplanationLine[];
};

export type Settlement = Audit & {
  id: string; property_id: string; worker_id: string; period_start: string; period_end: string; settled_on: string;
  pay_basis: PayBasis; rate_paise: number; opening_balance_paise: number;
  base_paise: number; offday_extra_paise: number; overtime_paise: number; bonus_paise: number; deduction_paise: number;
  earned_paise: number; paid_in_period_paise: number; paid_now_paise: number; advance_recovered_paise: number;
  advance_after_paise: number; closing_balance_paise: number; summary: SettlementSummary | Record<string, never>;
  note: string | null; voids_id: string | null;
};
