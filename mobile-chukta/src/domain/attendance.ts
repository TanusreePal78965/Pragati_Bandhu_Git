import type { AttendanceEntry } from './types';

const ts = (s: string) => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
};

/** Effective entry per date for ONE worker: greatest (created_at instant, id). Rows are append-only; corrections are newer rows. */
export function effectiveAttendance(entries: AttendanceEntry[]): Map<string, AttendanceEntry> {
  const out = new Map<string, AttendanceEntry>();
  const worker = entries[0]?.worker_id;
  for (const e of entries) {
    if (e.worker_id !== worker) throw new Error('effectiveAttendance expects entries for a single worker');
    const cur = out.get(e.date);
    if (!cur) { out.set(e.date, e); continue; }
    const d = ts(e.created_at) - ts(cur.created_at);
    if (d > 0 || (d === 0 && e.id > cur.id)) out.set(e.date, e);
  }
  return out;
}

/** Excludes void rows and the rows they void. */
export function activeMoneyRows<T extends { id: string; voids_id: string | null }>(rows: T[]): T[] {
  const voided = new Set(rows.filter((r) => r.voids_id).map((r) => r.voids_id as string));
  return rows.filter((r) => !r.voids_id && !voided.has(r.id));
}
