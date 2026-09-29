import type { AttendanceEntry } from './types';

/** Effective entry per date: greatest (created_at, id). Rows are append-only; corrections are newer rows. */
export function effectiveAttendance(entries: AttendanceEntry[]): Map<string, AttendanceEntry> {
  const out = new Map<string, AttendanceEntry>();
  for (const e of entries) {
    const cur = out.get(e.date);
    if (!cur || e.created_at > cur.created_at || (e.created_at === cur.created_at && e.id > cur.id)) out.set(e.date, e);
  }
  return out;
}

/** Excludes void rows and the rows they void. */
export function activeMoneyRows<T extends { id: string; voids_id: string | null }>(rows: T[]): T[] {
  const voided = new Set(rows.filter((r) => r.voids_id).map((r) => r.voids_id as string));
  return rows.filter((r) => !r.voids_id && !voided.has(r.id));
}
