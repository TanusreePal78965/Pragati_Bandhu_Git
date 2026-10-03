import type { AdvanceEntry, AttendanceEntry, Property, WagePayment, Worker } from '../../domain/types';

export const property = (over: Partial<Property> = {}): Property => ({
  id: 'p1', shop_id: 'shop1', name: 'Main', address: null, is_active: 1, default_pay_basis: 'daily', default_attendance_mode: 'day',
  shift_hours: 8, weekly_off: 0, monthly_divisor: 'calendar', offday_multiplier: 1, ot_mode: 'multiplier', ot_multiplier: 1, ot_rate_paise: null,
  created_at: '2026-09-01T00:00:00Z', server_updated_at: null, ...over,
});

export const worker = (over: Partial<Worker> = {}): Worker => ({
  id: 'w1', property_id: 'p1', name: 'Ram', phone: null, pay_basis: 'daily', rate_paise: 50000, joining_date: '2026-09-01',
  status: 'active', left_date: null, attendance_mode: null, shift_hours: null, weekly_off_override: 0, weekly_off: null,
  monthly_divisor: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-01T00:00:00Z', server_updated_at: null, ...over,
});

let n = 0;
export const att = (date: string, status: AttendanceEntry['status'], over: Partial<AttendanceEntry> = {}): AttendanceEntry => ({
  id: `a${String(n++).padStart(4, '0')}`, property_id: 'p1', worker_id: 'w1', date, status, hours: null, note: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});

export const adv = (id: string, over: Partial<AdvanceEntry> = {}): AdvanceEntry => ({
  id, property_id: 'p1', worker_id: 'w1', type: 'advance', amount_paise: 100000, date: '2026-09-02', mode: 'cash', note: null,
  voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-02T10:00:00Z', server_updated_at: null, ...over,
});

export const pay = (id: string, over: Partial<WagePayment> = {}): WagePayment => ({
  id, property_id: 'p1', worker_id: 'w1', amount_paise: 50000, date: '2026-09-05', mode: 'upi', note: null,
  voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-05T10:00:00Z', server_updated_at: null, ...over,
});
