import { effectiveAttendance } from '../domain/attendance';
import { classifyDay, type DayClass } from '../domain/dayClass';
import { effectiveDaysOff, latestByDate } from '../domain/latest';
import { resolveSettings } from '../domain/settings';
import type { AttendanceEntry, DayOff, OvertimeEntry, Property, ResolvedSettings, Worker } from '../domain/types';
import { compareDates } from '../utils/dates';

export type TodayRow = {
  worker: Worker; settings: ResolvedSettings;
  /** Full day off (weekly off, holiday or closure): attendance here means work on a day off. */
  isOff: boolean;
  dayClass: DayClass; entry: AttendanceEntry | null; overtime: OvertimeEntry | null; autoOtHours: number;
};

export function effectiveDayOffFor(daysOff: DayOff[], date: string): DayOff | null {
  return effectiveDaysOff(daysOff.filter((d) => d.date === date)).get(date) ?? null;
}

/** One row per worker employed on `date`, with that day's effective attendance and overtime (latest wins). */
export function buildTodayRows(
  workers: Worker[], property: Property, entries: AttendanceEntry[], date: string,
  daysOff: DayOff[] = [], overtime: OvertimeEntry[] = [],
): TodayRow[] {
  const dayOff = effectiveDayOffFor(daysOff, date) ?? undefined;
  const byWorker = new Map<string, AttendanceEntry[]>();
  for (const e of entries) {
    if (e.date !== date) continue;
    const list = byWorker.get(e.worker_id) ?? [];
    list.push(e);
    byWorker.set(e.worker_id, list);
  }
  const otByWorker = new Map<string, OvertimeEntry[]>();
  for (const o of overtime) {
    if (o.date !== date) continue;
    const list = otByWorker.get(o.worker_id) ?? [];
    list.push(o);
    otByWorker.set(o.worker_id, list);
  }
  const rows: TodayRow[] = [];
  for (const worker of workers) {
    if (compareDates(date, worker.joining_date) < 0) continue;
    if (worker.left_date && compareDates(date, worker.left_date) > 0) continue;
    const settings = resolveSettings(worker, property);
    const dayClass = classifyDay(date, settings, dayOff);
    const list = byWorker.get(worker.id);
    const entry = list ? effectiveAttendance(list).get(date) ?? null : null;
    const shift = settings.shiftHours > 0 ? settings.shiftHours : 8;
    const ot = otByWorker.get(worker.id);
    rows.push({
      worker, settings, dayClass, entry,
      isOff: dayClass.kind === 'off' && dayClass.portion === 'full',
      overtime: ot ? latestByDate(ot).get(date) ?? null : null,
      autoOtHours: entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0,
    });
  }
  return rows;
}
