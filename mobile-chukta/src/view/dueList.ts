import type { SqlDb } from '../db/sqlDb';
import type { Period } from '../domain/cycles';
import type { Property, Worker } from '../domain/types';
import { getDueSettlement } from '../repos/settlements';
import { listWorkers } from '../repos/workers';
import { compareDates } from '../utils/dates';
import type { Translate } from '../utils/format';

export type DueRow = { worker: Worker; period: Period; wageDuePaise: number };

/** "1–5 Sep", "27 Sep–3 Oct" or "27 Dec 2026–2 Jan 2027"; month names come from i18n like formatDate. */
export function formatPeriod(p: Period, t: Translate): string {
  const [ys, ms, ds] = p.start.split('-').map(Number);
  const [ye, me, de] = p.end.split('-').map(Number);
  const mon = (m: number) => t(`months.short.m${m}`);
  if (ys !== ye) return `${ds} ${mon(ms)} ${ys}–${de} ${mon(me)} ${ye}`;
  if (ms !== me) return `${ds} ${mon(ms)}–${de} ${mon(me)}`;
  return `${ds}–${de} ${mon(ms)}`;
}

/** Workers (incl. those who left) with an ended, unsettled period: the oldest due period each.
 *  Builds one draft per worker, which is fine for shop-sized teams (under about 50 workers). */
export async function listDueSettlements(db: SqlDb, property: Property, today: string): Promise<DueRow[]> {
  const workers = await listWorkers(db, property.id, true);
  const rows: DueRow[] = [];
  for (const worker of workers) {
    const due = await getDueSettlement(db, worker, property, today);
    if (due) rows.push({ worker, period: due.period, wageDuePaise: due.draft.wageDuePaise });
  }
  return rows.sort((a, b) => compareDates(a.period.end, b.period.end) || a.worker.name.localeCompare(b.worker.name));
}
