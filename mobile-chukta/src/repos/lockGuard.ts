import type { SqlDb } from '../db/sqlDb';

export class SettledError extends Error {
  constructor() { super('period is settled'); }
}

const ACTIVE_COVERING = `
  select s.id from settlements s
  where s.voids_id is null and ? between s.period_start and s.period_end
    and not exists (select 1 from settlements v where v.voids_id = s.id)`;

export async function assertWorkerDateOpen(db: SqlDb, workerId: string, date: string): Promise<void> {
  const hit = await db.getFirstAsync(`${ACTIVE_COVERING} and s.worker_id = ? limit 1`, [date, workerId]);
  if (hit) throw new SettledError();
}

export async function assertPropertyDateOpen(db: SqlDb, propertyId: string, date: string): Promise<void> {
  const hit = await db.getFirstAsync(`${ACTIVE_COVERING} and s.property_id = ? limit 1`, [date, propertyId]);
  if (hit) throw new SettledError();
}
