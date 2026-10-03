import type { SqlDb } from '../db/sqlDb';
import type { Period } from '../domain/cycles';
import type { Property, Worker } from '../domain/types';
import { getDueSettlement } from '../repos/settlements';
import { listWorkers } from '../repos/workers';
import { compareDates } from '../utils/dates';

export type DueRow = { worker: Worker; period: Period; wageDuePaise: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPeriod(p: Period): string {
  const [ys, ms, ds] = p.start.split('-').map(Number);
  const [ye, me, de] = p.end.split('-').map(Number);
  if (ys !== ye) return `${ds} ${MONTHS[ms - 1]} ${ys}–${de} ${MONTHS[me - 1]} ${ye}`;
  if (ms !== me) return `${ds} ${MONTHS[ms - 1]}–${de} ${MONTHS[me - 1]}`;
  return `${ds}–${de} ${MONTHS[ms - 1]}`;
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
