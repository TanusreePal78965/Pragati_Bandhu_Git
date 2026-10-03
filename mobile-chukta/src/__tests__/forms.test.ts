import {
  parseOptionalAmount, parseOvertimeHours, propertyToFormValues, toNewWorker, toWorkerPatch, validateMoneyForm, validatePropertyForm, validateHolidayForm, validateStaffForm, validateWorkerForm,
  workerToFormValues, type WorkerFormValues,
} from '../view/forms';
import { property, worker } from './helpers/fixtures';

const W: WorkerFormValues = {
  name: ' Ram ', phone: '', payBasis: 'daily', rate: '500', joiningDate: '2026-09-01', attendanceMode: null, shiftHours: '',
  weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null, hasLeft: false, leftDate: null,
  offdayMultiplier: null, otMode: null, otMultiplier: null, otRate: '',
};

test('worker form: valid input is normalised', () => {
  const r = validateWorkerForm(W);
  expect(r).toEqual({ ok: true, value: {
    name: 'Ram', phone: null, payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01', attendanceMode: null, shiftHours: null,
    weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null, leftDate: null,
    offdayMultiplier: null, otMode: null, otMultiplier: null, otRatePaise: null,
  } });
});

test('worker form: errors are i18n keys per field', () => {
  const r = validateWorkerForm({ ...W, name: ' ', rate: '0', phone: '12345', shiftHours: '25', hasLeft: true, leftDate: '2026-08-01' });
  expect(r).toEqual({ ok: false, errors: {
    name: 'workerForm.nameRequired', rate: 'workerForm.rateInvalid', phone: 'workerForm.phoneInvalid',
    shiftHours: 'fields.shiftInvalid', leftDate: 'workerForm.leftBeforeJoin',
  } });
});

test('worker form: hourly forces hours; divisor only for monthly; weekly off only when overridden', () => {
  const r = validateWorkerForm({ ...W, payBasis: 'hourly', attendanceMode: 'day', monthlyDivisor: '26', weeklyOff: 3 });
  expect(r.ok && [r.value.attendanceMode, r.value.monthlyDivisor, r.value.weeklyOff]).toEqual(['hours', null, null]);
  const m = validateWorkerForm({ ...W, payBasis: 'monthly', monthlyDivisor: '26', weeklyOffOverride: true, weeklyOff: null });
  expect(m.ok && [m.value.monthlyDivisor, m.value.weeklyOffOverride, m.value.weeklyOff]).toEqual(['26', true, null]);
});

test('worker form maps to repo inputs', () => {
  const r = validateWorkerForm({ ...W, weeklyOffOverride: true, weeklyOff: 5, shiftHours: '7.5', hasLeft: true, leftDate: '2026-09-20' });
  if (!r.ok) throw new Error('expected ok');
  expect(toNewWorker('p1', r.value, true)).toEqual({
    propertyId: 'p1', name: 'Ram', phone: undefined, payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01',
    attendanceMode: undefined, shiftHours: 7.5, weeklyOff: 5, monthlyDivisor: undefined,
  });
  expect(toWorkerPatch(r.value, true)).toEqual({
    name: 'Ram', phone: null, pay_basis: 'daily', rate_paise: 50000, joining_date: '2026-09-01', attendance_mode: null, shift_hours: 7.5,
    weekly_off_override: 1, weekly_off: 5, monthly_divisor: null, status: 'left', left_date: '2026-09-20',
    offday_multiplier: null, ot_mode: null, ot_multiplier: null, ot_rate_paise: null,
  });
});

test('workerToFormValues round-trips an existing worker', () => {
  const v = workerToFormValues(worker({ rate_paise: 55050, shift_hours: 9, status: 'left', left_date: '2026-09-20' }));
  expect(v).toMatchObject({ name: 'Ram', rate: '550.50', shiftHours: '9', hasLeft: true, leftDate: '2026-09-20' });
});

test('money form: amount required, write-off needs a note', () => {
  expect(validateMoneyForm({ kind: 'advance', amount: '1,000', date: '2026-09-07', mode: 'cash', note: '' }))
    .toEqual({ ok: true, value: { amountPaise: 100000, date: '2026-09-07', mode: 'cash', note: null } });
  expect(validateMoneyForm({ kind: 'writeoff', amount: 'x', date: '2026-09-07', mode: null, note: ' ' }))
    .toEqual({ ok: false, errors: { amount: 'money.amountInvalid', note: 'money.noteRequired' } });
});

test('staff form: PIN required when new, optional on edit, must match', () => {
  expect(validateStaffForm({ isNew: true, name: 'A', pin: '', pinConfirm: '' })).toEqual({ ok: false, errors: { pin: 'staff.error.pinInvalid' } });
  expect(validateStaffForm({ isNew: false, name: 'A', pin: '', pinConfirm: '' })).toEqual({ ok: true, value: { name: 'A', pin: null } });
  expect(validateStaffForm({ isNew: true, name: '', pin: '1234', pinConfirm: '1243' }))
    .toEqual({ ok: false, errors: { name: 'staff.error.nameRequired', pinConfirm: 'staff.error.pinMismatch' } });
  expect(validateStaffForm({ isNew: true, name: 'A', pin: '1234567', pinConfirm: '1234567' }).ok).toBe(false);
  expect(validateStaffForm({ isNew: true, name: 'A', pin: '12345', pinConfirm: '12345' }).ok).toBe(false);
  expect(validateStaffForm({ isNew: false, name: 'A', pin: '123456', pinConfirm: '123456' }).ok).toBe(false);
});

test('property form: name and shift hours validated; defaults come from the property', () => {
  const v = propertyToFormValues(property({ weekly_off: 5, shift_hours: 9 }));
  expect(v).toMatchObject({ name: 'Main', shiftHours: '9', weeklyOff: 5 });
  expect(validatePropertyForm(v)).toEqual({ ok: true, value: {
    name: 'Main', address: null, default_pay_basis: 'daily', default_attendance_mode: 'day', shift_hours: 9, weekly_off: 5, monthly_divisor: 'calendar',
    offday_multiplier: 1, ot_mode: 'multiplier', ot_multiplier: 1, ot_rate_paise: null,
  } });
  expect(validatePropertyForm({ ...propertyToFormValues(null), name: ' ', shiftHours: '0' }))
    .toEqual({ ok: false, errors: { name: 'properties.nameRequired', shiftHours: 'fields.shiftInvalid' } });
});

test('extra-pay validation: fixed overtime needs a rate (property and worker)', () => {
  const p = { ...propertyToFormValues(property()), otMode: 'fixed' as const, otRate: '' };
  expect(validatePropertyForm(p)).toEqual({ ok: false, errors: { otRate: 'extraPay.otRateRequired' } });
  expect(validatePropertyForm({ ...p, otRate: '60' })).toMatchObject({ ok: true, value: { ot_mode: 'fixed', ot_rate_paise: 6000 } });
  expect(validateWorkerForm({ ...W, otMode: 'fixed', otRate: '' })).toMatchObject({ ok: false, errors: { otRate: 'extraPay.otRateRequired' } });
  expect(validateWorkerForm({ ...W, offdayMultiplier: 1.5, otMode: 'fixed', otRate: '75' }))
    .toMatchObject({ ok: true, value: { offdayMultiplier: 1.5, otMode: 'fixed', otRatePaise: 7500 } });
});

test('a deduction needs a reason; a bonus does not', () => {
  expect(validateMoneyForm({ kind: 'deduction', amount: '100', date: '2026-09-07', mode: null, note: '' }))
    .toEqual({ ok: false, errors: { note: 'money.noteRequiredDeduction' } });
  expect(validateMoneyForm({ kind: 'bonus', amount: '100', date: '2026-09-07', mode: null, note: '' }).ok).toBe(true);
});

test('holiday form and helpers', () => {
  expect(validateHolidayForm({ name: ' ', date: '2026-10-20', kind: 'holiday', portion: 'full', payRule: 'by_basis', isActive: true }))
    .toEqual({ ok: false, errors: { name: 'daysOff.nameRequired' } });
  expect(parseOvertimeHours('2.5')).toBe(2.5);
  expect(parseOvertimeHours('17')).toBeNull();
  expect(parseOptionalAmount('')).toBeNull();
  expect(parseOptionalAmount('1,200')).toBe(120000);
  expect(parseOptionalAmount('abc')).toBeUndefined();
});

test('extra-pay keys are left out of worker inputs for staff, present for the owner', () => {
  const r = validateWorkerForm({ ...W, offdayMultiplier: 2, otMode: 'fixed', otRate: '75' });
  if (!r.ok) throw new Error('expected ok');
  const keys = ['offday_multiplier', 'ot_mode', 'ot_multiplier', 'ot_rate_paise'];
  const newKeys = ['offdayMultiplier', 'otMode', 'otMultiplier', 'otRatePaise'];
  const staffPatch = toWorkerPatch(r.value, false);
  for (const k of keys) expect(k in staffPatch).toBe(false);
  for (const k of newKeys) expect(k in toNewWorker('p1', r.value, false)).toBe(false);
  expect(toWorkerPatch(r.value, true)).toMatchObject({ offday_multiplier: 2, ot_mode: 'fixed', ot_multiplier: null, ot_rate_paise: 7500 });
  for (const k of newKeys) expect(k in toNewWorker('p1', r.value, true)).toBe(true);
});
