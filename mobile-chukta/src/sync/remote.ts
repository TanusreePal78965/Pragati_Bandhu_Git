import type { SupabaseClient } from '@supabase/supabase-js';
import { TABLE_COLUMNS, type SyncedTable } from '../db/schema';
import { cursorFilter, type Cursor, type RemoteReader } from './pull';
import type { RemoteError, RemoteWriter } from './push';

const BOOLEAN_COLUMNS = new Set(['is_active', 'weekly_off_override']);

function toServer(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = BOOLEAN_COLUMNS.has(k) ? v === 1 || v === true : v;
  return out;
}

function toError(e: { code?: string; message: string } | null, status: number | null): RemoteError | null {
  return e ? { status, code: e.code ?? null, message: e.message } : null;
}

export function createSupabaseRemote(client: SupabaseClient): RemoteWriter & RemoteReader {
  const chukta = () => client.schema('chukta');
  return {
    async write(item) {
      try {
        if (item.op === 'insert') {
          // Idempotent create: INSERT ... ON CONFLICT (id) DO NOTHING — safe to retry, needs no UPDATE privilege.
          const { error, status } = await chukta().from(item.table).upsert(toServer(item.payload), { onConflict: 'id', ignoreDuplicates: true });
          return toError(error, status);
        }
        const { id: _id, ...patch } = item.payload;
        const { data, error, status } = await chukta().from(item.table).update(toServer(patch)).eq('id', item.rowId).select('id');
        if (error) return toError(error, status);
        if (!data || data.length === 0) return { status: 404, code: null, message: `${item.table} ${item.rowId} not found or not permitted` };
        return null;
      } catch (e) {
        return { status: null, code: null, message: e instanceof Error ? e.message : String(e) };
      }
    },
    async fetchSince(table: SyncedTable, cursor: Cursor | null, limit: number) {
      try {
        let q = chukta().from(table).select(TABLE_COLUMNS[table].join(','))
          .order('server_updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
        if (cursor) {
          const f = cursorFilter(cursor);
          q = f.kind === 'gte' ? q.gte('server_updated_at', f.ts) : q.or(f.or);
        }
        const { data, error, status } = await q;
        return { rows: (data ?? []) as unknown as Record<string, unknown>[], error: toError(error, status) };
      } catch (e) {
        return { rows: [], error: { status: null, code: null, message: e instanceof Error ? e.message : String(e) } };
      }
    },
  };
}
