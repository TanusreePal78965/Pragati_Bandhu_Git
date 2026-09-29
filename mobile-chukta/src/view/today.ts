import { effectiveAttendance } from '../domain/attendance';
import { resolveSettings } from '../domain/settings';
import type { AttendanceEntry, Property, ResolvedSettings, Worker } from '../domain/types';
import { compareDates, weekday } from '../utils/dates';

export type TodayRow = { worker: Worker; settings: ResolvedSettings; isOff: boolean; entry: AttendanceEntry | null };

/** One row per worker employed on `date`, with that day's effective entry (latest wins). */
export function buildTodayRows(workers: Worker[], property: Property, entries: AttendanceEntry[], date: string): TodayRow[] {
  const byWorker = new Map<string, AttendanceEntry[]>();
  for (const e of entries) {
    if (e.date !== date) continue;
    const list = byWorker.get(e.worker_id) ?? [];
    list.push(e);
    byWorker.set(e.worker_id, list);
  }
  const rows: TodayRow[] = [];
  for (const worker of workers) {
    if (compareDates(date, worker.joining_date) < 0) continue;
    if (worker.left_date && compareDates(date, worker.left_date) > 0) continue;
    const settings = resolveSettings(worker, property);
    const list = byWorker.get(worker.id);
    rows.push({
      worker,
      settings,
      isOff: settings.weeklyOff !== null && weekday(date) === settings.weeklyOff,
      entry: list ? effectiveAttendance(list).get(date) ?? null : null,
    });
  }
  return rows;
}
