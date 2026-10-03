import type { Property, ResolvedSettings, Worker } from './types';

export function resolveSettings(worker: Worker, property: Property): ResolvedSettings {
  const payBasis = worker.pay_basis;
  return {
    payBasis,
    attendanceMode: payBasis === 'hourly' ? 'hours' : worker.attendance_mode ?? property.default_attendance_mode,
    shiftHours: worker.shift_hours ?? property.shift_hours,
    weeklyOff: worker.weekly_off_override ? worker.weekly_off : property.weekly_off,
    monthlyDivisor: worker.monthly_divisor ?? property.monthly_divisor,
    offdayMultiplier: worker.offday_multiplier ?? property.offday_multiplier ?? 1,
    otMode: worker.ot_mode ?? property.ot_mode ?? 'multiplier',
    otMultiplier: worker.ot_multiplier ?? property.ot_multiplier ?? 1,
    otRatePaise: worker.ot_rate_paise ?? property.ot_rate_paise ?? null,
  };
}
