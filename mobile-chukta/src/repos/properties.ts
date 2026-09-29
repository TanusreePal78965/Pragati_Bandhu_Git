import type { SqlDb } from '../db/sqlDb';
import type { Property } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue, updateAndEnqueue } from './write';

export type PropertySettingsPatch = Partial<Pick<Property,
  'name' | 'address' | 'is_active' | 'default_pay_basis' | 'default_attendance_mode' | 'shift_hours' | 'weekly_off' | 'monthly_divisor'>>;

export async function createProperty(ctx: RepoContext, input: { shopId: string; name: string; address?: string }): Promise<Property> {
  const row: Property = {
    id: ctx.newId(), shop_id: input.shopId, name: input.name.trim(), address: input.address ?? null, is_active: 1,
    default_pay_basis: 'daily', default_attendance_mode: 'day', shift_hours: 8, weekly_off: 0, monthly_divisor: 'calendar',
    created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'properties', row);
  return row;
}

export async function updatePropertySettings(ctx: RepoContext, id: string, patch: PropertySettingsPatch): Promise<void> {
  await updateAndEnqueue(ctx, 'properties', id, patch);
}

export async function listProperties(db: SqlDb): Promise<Property[]> {
  return db.getAllAsync<Property>('select * from properties where is_active = 1 order by name');
}

export async function getProperty(db: SqlDb, id: string): Promise<Property | null> {
  return db.getFirstAsync<Property>('select * from properties where id = ?', [id]);
}
