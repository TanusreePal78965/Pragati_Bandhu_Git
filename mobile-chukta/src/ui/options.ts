import type { AttendanceMode, MonthlyDivisor, PayBasis, PaymentMode } from '../domain/types';

export const PAY_BASES: PayBasis[] = ['hourly', 'daily', 'weekly', 'monthly'];
export const ATTENDANCE_MODES: AttendanceMode[] = ['day', 'hours'];
export const DIVISORS: MonthlyDivisor[] = ['calendar', '26', '30'];
export const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'bank'];
