import type { DayOff } from './types';

const ts = (s: string) => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
};

/** Newest row per date: greatest (created_at instant, id). Rows are append-only; corrections are newer rows. */
export function latestByDate<T extends { date: string; created_at: string; id: string }>(rows: T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    const cur = out.get(r.date);
    if (!cur) { out.set(r.date, r); continue; }
    const d = ts(r.created_at) - ts(cur.created_at);
    if (d > 0 || (d === 0 && r.id > cur.id)) out.set(r.date, r);
  }
  return out;
}

/** The property's effective day off per date: the newest *active* row (a deactivated row never applies). */
export function effectiveDaysOff(rows: DayOff[]): Map<string, DayOff> {
  return latestByDate(rows.filter((r) => r.is_active === 1));
}
