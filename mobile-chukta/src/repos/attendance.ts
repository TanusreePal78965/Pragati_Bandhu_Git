import type { SqlDb } from '../db/sqlDb';
import type { AttendanceEntry, AttendanceStatus } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue } from './write';

export async function markAttendance(
  ctx: RepoContext,
  input: { propertyId: string; workerId: string; date: string; status: AttendanceStatus; hours?: number; note?: string },
): Promise<AttendanceEntry> {
  if (input.status === 'hours' && (input.hours === undefined || input.hours < 0 || input.hours > 24)) {
    throw new Error('hours between 0 and 24 required for status hours');
  }
  const row: AttendanceEntry = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, date: input.date, status: input.status,
    hours: input.status === 'hours' ? input.hours! : null, note: input.note ?? null,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'attendance_entries', row);
  return row;
}

export async function listAttendance(db: SqlDb, workerId: string, from: string, to: string): Promise<AttendanceEntry[]> {
  return db.getAllAsync<AttendanceEntry>(
    'select * from attendance_entries where worker_id = ? and date between ? and ? order by created_at, id', [workerId, from, to]);
}
