import type { SqlDb } from '../db/sqlDb';
import type { StaffUser } from '../domain/types';

/** Staff of one property as synced from the server (no PIN data ever reaches the phone). */
export async function listStaff(db: SqlDb, propertyId: string): Promise<StaffUser[]> {
  return db.getAllAsync<StaffUser>('select * from staff_users where property_id = ? order by is_active desc, name', [propertyId]);
}

export async function getStaffUser(db: SqlDb, id: string): Promise<StaffUser | null> {
  return db.getFirstAsync<StaffUser>('select * from staff_users where id = ?', [id]);
}
