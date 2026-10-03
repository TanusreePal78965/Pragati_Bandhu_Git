import type {
  AttendanceMode, DayOff, DayOffKind, DayOffPayRule, DayOffPortion, MonthlyDivisor, OtMode, PayBasis, PaymentMode, Property, Worker,
} from '../domain/types';
import type { PropertySettingsPatch } from '../repos/properties';
import type { NewWorker, WorkerPatch } from '../repos/workers';
import { compareDates } from '../utils/dates';
import { rupeesToPaise } from '../utils/money';
import type { MoneyKind } from './moneyHistory';

export type FieldErrors = Record<string, string>;
export type Validation<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const done = <T>(errors: FieldErrors, value: () => T): Validation<T> =>
  Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: value() };

/** '' → null (use default); a number in (0, 24] with ≤2 decimals; anything else → undefined (invalid). */
function parseShift(s: string): number | null | undefined {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 && n <= 24 ? n : undefined;
}

const paiseToInput = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

// ---- worker ----
export type WorkerFormValues = {
  name: string; phone: string; payBasis: PayBasis; rate: string; joiningDate: string; attendanceMode: AttendanceMode | null;
  shiftHours: string; weeklyOffOverride: boolean; weeklyOff: number | null; monthlyDivisor: MonthlyDivisor | null;
  hasLeft: boolean; leftDate: string | null;
  offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRate: string;
};
export type WorkerFormResult = {
  name: string; phone: string | null; payBasis: PayBasis; ratePaise: number; joiningDate: string; attendanceMode: AttendanceMode | null;
  shiftHours: number | null; weeklyOffOverride: boolean; weeklyOff: number | null; monthlyDivisor: MonthlyDivisor | null; leftDate: string | null;
  offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRatePaise: number | null;
};

export function validateWorkerForm(v: WorkerFormValues): Validation<WorkerFormResult> {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'workerForm.nameRequired';
  const ratePaise = rupeesToPaise(v.rate);
  if (ratePaise === null || ratePaise <= 0) errors.rate = 'workerForm.rateInvalid';
  const phone = v.phone.replace(/\D/g, '');
  if (phone && phone.length !== 10) errors.phone = 'workerForm.phoneInvalid';
  const shift = parseShift(v.shiftHours);
  if (shift === undefined) errors.shiftHours = 'fields.shiftInvalid';
  const otRatePaise = v.otRate.trim() ? rupeesToPaise(v.otRate) : null;
  if (v.otMode === 'fixed' && !(otRatePaise && otRatePaise > 0)) errors.otRate = 'extraPay.otRateRequired';
  const leftDate = v.hasLeft ? v.leftDate : null;
  if (v.hasLeft && (!leftDate || compareDates(leftDate, v.joiningDate) < 0)) errors.leftDate = 'workerForm.leftBeforeJoin';
  return done(errors, () => ({
    name, phone: phone || null, payBasis: v.payBasis, ratePaise: ratePaise as number, joiningDate: v.joiningDate,
    attendanceMode: v.payBasis === 'hourly' ? 'hours' : v.attendanceMode, shiftHours: shift ?? null,
    weeklyOffOverride: v.weeklyOffOverride, weeklyOff: v.weeklyOffOverride ? v.weeklyOff : null,
    monthlyDivisor: v.payBasis === 'monthly' ? v.monthlyDivisor : null, leftDate,
    offdayMultiplier: v.offdayMultiplier, otMode: v.otMode, otMultiplier: v.otMultiplier,
    otRatePaise: otRatePaise && otRatePaise > 0 ? otRatePaise : null,
  }));
}

/** Staff cannot set extra-pay values, so for a non-owner the four keys are left out entirely. */
export function toNewWorker(propertyId: string, r: WorkerFormResult, isOwner: boolean): NewWorker {
  return {
    propertyId, name: r.name, phone: r.phone ?? undefined, payBasis: r.payBasis, ratePaise: r.ratePaise, joiningDate: r.joiningDate,
    attendanceMode: r.attendanceMode ?? undefined, shiftHours: r.shiftHours ?? undefined,
    weeklyOff: r.weeklyOffOverride ? r.weeklyOff : undefined, monthlyDivisor: r.monthlyDivisor ?? undefined,
    ...(isOwner ? {
      offdayMultiplier: r.offdayMultiplier ?? undefined, otMode: r.otMode ?? undefined,
      otMultiplier: r.otMultiplier ?? undefined, otRatePaise: r.otRatePaise ?? undefined,
    } : {}),
  };
}

export function toWorkerPatch(r: WorkerFormResult, isOwner: boolean): WorkerPatch {
  return {
    name: r.name, phone: r.phone, pay_basis: r.payBasis, rate_paise: r.ratePaise, joining_date: r.joiningDate,
    attendance_mode: r.attendanceMode, shift_hours: r.shiftHours, weekly_off_override: r.weeklyOffOverride ? 1 : 0,
    weekly_off: r.weeklyOff, monthly_divisor: r.monthlyDivisor, status: r.leftDate ? 'left' : 'active', left_date: r.leftDate,
    ...(isOwner ? {
      offday_multiplier: r.offdayMultiplier, ot_mode: r.otMode, ot_multiplier: r.otMultiplier, ot_rate_paise: r.otRatePaise,
    } : {}),
  };
}

export function workerToFormValues(w: Worker): WorkerFormValues {
  return {
    name: w.name, phone: w.phone ?? '', payBasis: w.pay_basis, rate: paiseToInput(w.rate_paise), joiningDate: w.joining_date,
    attendanceMode: w.attendance_mode, shiftHours: w.shift_hours === null ? '' : String(w.shift_hours),
    weeklyOffOverride: w.weekly_off_override === 1, weeklyOff: w.weekly_off, monthlyDivisor: w.monthly_divisor,
    hasLeft: w.status === 'left', leftDate: w.left_date,
    offdayMultiplier: w.offday_multiplier ?? null, otMode: w.ot_mode ?? null, otMultiplier: w.ot_multiplier ?? null,
    otRate: w.ot_rate_paise ? paiseToInput(w.ot_rate_paise) : '',
  };
}

// ---- money ----
export type MoneyFormValues = { kind: MoneyKind; amount: string; date: string; mode: PaymentMode | null; note: string };

export function validateMoneyForm(v: MoneyFormValues): Validation<{ amountPaise: number; date: string; mode: PaymentMode | null; note: string | null }> {
  const errors: FieldErrors = {};
  const amountPaise = rupeesToPaise(v.amount);
  if (amountPaise === null || amountPaise <= 0) errors.amount = 'money.amountInvalid';
  const note = v.note.trim();
  if (v.kind === 'writeoff' && !note) errors.note = 'money.noteRequired';
  if (v.kind === 'deduction' && !note) errors.note = 'money.noteRequiredDeduction';
  return done(errors, () => ({ amountPaise: amountPaise as number, date: v.date, mode: v.mode, note: note || null }));
}

export const MULTIPLIERS = [1, 1.5, 2] as const;

/** Overtime hours: 0-16 with up to 2 decimals; anything else gives null (invalid). */
export function parseOvertimeHours(s: string): number | null {
  const t = s.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 16 ? n : null;
}

/** Optional rupee amount: '' gives null (not set); valid gives paise; invalid gives undefined. */
export function parseOptionalAmount(s: string): number | null | undefined {
  if (!s.trim()) return null;
  const p = rupeesToPaise(s);
  return p === null ? undefined : p;
}

// ---- holiday / closure ----
export type HolidayFormValues = { name: string; date: string; kind: DayOffKind; portion: DayOffPortion; payRule: DayOffPayRule; isActive: boolean };

export function holidayToFormValues(d: DayOff | null, today: string): HolidayFormValues {
  return d
    ? { name: d.name, date: d.date, kind: d.kind, portion: d.portion, payRule: d.pay_rule, isActive: d.is_active === 1 }
    : { name: '', date: today, kind: 'holiday', portion: 'full', payRule: 'by_basis', isActive: true };
}

export function validateHolidayForm(v: HolidayFormValues): Validation<HolidayFormValues> {
  const name = v.name.trim();
  return done(name ? {} : { name: 'daysOff.nameRequired' }, () => ({ ...v, name }));
}

// ---- staff ----
export type StaffFormValues = { isNew: boolean; name: string; pin: string; pinConfirm: string };

export function validateStaffForm(v: StaffFormValues): Validation<{ name: string; pin: string | null }> {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'staff.error.nameRequired';
  const pin = v.pin.trim();
  if ((v.isNew || pin) && !/^\d{4}$/.test(pin)) errors.pin = 'staff.error.pinInvalid';
  else if (pin && pin !== v.pinConfirm.trim()) errors.pinConfirm = 'staff.error.pinMismatch';
  return done(errors, () => ({ name, pin: pin || null }));
}

// ---- property ----
export type PropertyFormValues = {
  name: string; address: string; defaultPayBasis: PayBasis; defaultAttendanceMode: AttendanceMode; shiftHours: string;
  weeklyOff: number | null; monthlyDivisor: MonthlyDivisor;
  offdayMultiplier: number; otMode: OtMode; otMultiplier: number; otRate: string;
};

export function propertyToFormValues(p: Property | null): PropertyFormValues {
  return {
    name: p?.name ?? '', address: p?.address ?? '', defaultPayBasis: p?.default_pay_basis ?? 'daily',
    defaultAttendanceMode: p?.default_attendance_mode ?? 'day', shiftHours: String(p?.shift_hours ?? 8),
    weeklyOff: p ? p.weekly_off : 0, monthlyDivisor: p?.monthly_divisor ?? 'calendar',
    offdayMultiplier: p?.offday_multiplier ?? 1, otMode: p?.ot_mode ?? 'multiplier', otMultiplier: p?.ot_multiplier ?? 1,
    otRate: p?.ot_rate_paise ? paiseToInput(p.ot_rate_paise) : '',
  };
}

export function validatePropertyForm(v: PropertyFormValues): Validation<Required<Omit<PropertySettingsPatch, 'is_active'>>> {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'properties.nameRequired';
  const shift = parseShift(v.shiftHours);
  if (shift === undefined || shift === null) errors.shiftHours = 'fields.shiftInvalid';
  const otRatePaise = v.otRate.trim() ? rupeesToPaise(v.otRate) : null;
  if (v.otMode === 'fixed' && !(otRatePaise && otRatePaise > 0)) errors.otRate = 'extraPay.otRateRequired';
  return done(errors, () => ({
    name, address: v.address.trim() || null, default_pay_basis: v.defaultPayBasis, default_attendance_mode: v.defaultAttendanceMode,
    shift_hours: shift as number, weekly_off: v.weeklyOff, monthly_divisor: v.monthlyDivisor,
    offday_multiplier: v.offdayMultiplier, ot_mode: v.otMode, ot_multiplier: v.otMultiplier,
    ot_rate_paise: otRatePaise && otRatePaise > 0 ? otRatePaise : null,
  }));
}
