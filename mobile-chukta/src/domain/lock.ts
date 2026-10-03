import { compareDates } from '../utils/dates';
import type { Settlement } from './types';

export function activeSettlements(rows: Settlement[]): Settlement[] {
  const voided = new Set(rows.filter((r) => r.voids_id).map((r) => r.voids_id as string));
  return rows.filter((r) => !r.voids_id && !voided.has(r.id));
}

export function lastSettledEnd(rows: Settlement[], workerId: string): string | null {
  let last: string | null = null;
  for (const r of activeSettlements(rows)) {
    if (r.worker_id === workerId && (!last || compareDates(r.period_end, last) > 0)) last = r.period_end;
  }
  return last;
}

export function isSettled(rows: Settlement[], workerId: string, date: string): boolean {
  return activeSettlements(rows).some((r) => r.worker_id === workerId
    && compareDates(date, r.period_start) >= 0 && compareDates(date, r.period_end) <= 0);
}
