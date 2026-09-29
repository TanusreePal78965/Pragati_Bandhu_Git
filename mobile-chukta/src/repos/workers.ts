import type { SqlDb } from '../db/sqlDb';
import type { AttendanceMode, MonthlyDivisor, PayBasis, Worker } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue, updateAndEnqueue } from './write';

export type NewWorker = {
  propertyId: string; name: string; phone?: string; payBasis: PayBasis; ratePaise: number; joiningDate: string;
  attendanceMode?: AttendanceMode; shiftHours?: number; weeklyOff?: number | null; monthlyDivisor?: MonthlyDivisor;
};
export type WorkerPatch = Partial<Pick<Worker,
  'name' | 'phone' | 'pay_basis' | 'rate_paise' | 'joining_date' | 'status' | 'left_date' | 'attendance_mode'
  | 'shift_hours' | 'weekly_off_override' | 'weekly_off' | 'monthly_divisor'>>;

export async function createWorker(ctx: RepoContext, input: NewWorker): Promise<Worker> {
  if (!input.name.trim()) throw new Error('name is required');
  if (!Number.isInteger(input.ratePaise) || input.ratePaise <= 0) throw new Error('rate must be a positive amount');
  const row: Worker = {
    id: ctx.newId(), property_id: input.propertyId, name: input.name.trim(), phone: input.phone ?? null,
    pay_basis: input.payBasis, rate_paise: input.ratePaise, joining_date: input.joiningDate, status: 'active', left_date: null,
    attendance_mode: input.payBasis === 'hourly' ? 'hours' : input.attendanceMode ?? null,
    shift_hours: input.shiftHours ?? null,
    weekly_off_override: input.weeklyOff === undefined ? 0 : 1,
    weekly_off: input.weeklyOff ?? null,
    monthly_divisor: input.monthlyDivisor ?? null,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'workers', row);
  return row;
}

export async function updateWorker(ctx: RepoContext, id: string, patch: WorkerPatch): Promise<void> {
  if (patch.status === 'left' && !patch.left_date) throw new Error('left_date is required when a worker leaves');
  if (patch.pay_basis === 'hourly') patch = { ...patch, attendance_mode: 'hours' };
  await updateAndEnqueue(ctx, 'workers', id, patch);
}

export async function listWorkers(db: SqlDb, propertyId: string, includeLeft = false): Promise<Worker[]> {
  return db.getAllAsync<Worker>(
    `select * from workers where property_id = ? ${includeLeft ? '' : "and status = 'active'"} order by name`, [propertyId]);
}

export async function getWorker(db: SqlDb, id: string): Promise<Worker | null> {
  return db.getFirstAsync<Worker>('select * from workers where id = ?', [id]);
}
