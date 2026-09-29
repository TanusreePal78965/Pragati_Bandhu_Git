import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthDeps } from './authService';
import type { Identity } from './identity';

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const IDENTITY_KEY = 'chukta.identity';
export const DEVICE_ID_KEY = 'chukta.deviceId';

export function projectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split('.')[0];
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function parseIdentity(raw: string | null): Identity | null {
  if (!raw) return null;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (v?.kind === 'owner' && isStr(v.userId) && isStr(v.shopId)) {
    return { kind: 'owner', userId: v.userId, shopId: v.shopId, phone: typeof v.phone === 'string' ? v.phone : '' };
  }
  if (v?.kind === 'staff' && isStr(v.userId) && isStr(v.staffId) && isStr(v.propertyId)) {
    return {
      kind: 'staff', userId: v.userId, staffId: v.staffId, propertyId: v.propertyId,
      staffName: typeof v.staffName === 'string' ? v.staffName : '', propertyName: typeof v.propertyName === 'string' ? v.propertyName : '',
    };
  }
  return null;
}

export function createAuthDeps(opts: {
  client: SupabaseClient; storage: KeyValueStore; supabaseUrl: string; anonKey: string; newId: () => string; fetchFn?: typeof fetch;
}): AuthDeps {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async post(path, body) {
      const res = await fetchFn(`${opts.supabaseUrl}/functions/v1/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: opts.anonKey, Authorization: `Bearer ${opts.anonKey}` },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    async setSession(access_token, refresh_token) {
      const { error } = await opts.client.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
    },
    async getSession() {
      const { data, error } = await opts.client.auth.getSession();
      return { hasSession: !!data.session, retryableError: !!error && isAuthRetryableFetchError(error) };
    },
    async signOutLocal() {
      await opts.client.auth.signOut({ scope: 'local' });
    },
    async clearStoredSession() {
      await opts.storage.removeItem(`sb-${projectRef(opts.supabaseUrl)}-auth-token`);
    },
    async saveIdentity(identity) {
      if (identity) await opts.storage.setItem(IDENTITY_KEY, JSON.stringify(identity));
      else await opts.storage.removeItem(IDENTITY_KEY);
    },
    async loadIdentity() {
      return parseIdentity(await opts.storage.getItem(IDENTITY_KEY));
    },
    async deviceId() {
      const existing = await opts.storage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const id = opts.newId();
      await opts.storage.setItem(DEVICE_ID_KEY, id);
      return id;
    },
  };
}
