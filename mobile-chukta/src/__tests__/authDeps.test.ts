import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { createAuthDeps, DEVICE_ID_KEY, IDENTITY_KEY, parseIdentity, projectRef } from '../auth/authDeps';

function memStore() {
  const m = new Map<string, string>();
  return { m, getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => { m.set(k, v); }, removeItem: async (k: string) => { m.delete(k); } };
}

function fakeClient(over: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const auth = {
    setSession: async (s: { access_token: string; refresh_token: string }) => { calls.push(`set:${s.access_token}:${s.refresh_token}`); return { error: null }; },
    getSession: async () => ({ data: { session: { access_token: 'a' } }, error: null }),
    signOut: async (o: { scope: string }) => { calls.push(`signOut:${o.scope}`); return { error: null }; },
    ...over,
  };
  return { client: { auth } as unknown as SupabaseClient, calls };
}

const URL_ = 'https://mhtqufyaxpunhenqropn.supabase.co';

test('post calls the edge function with apikey and parses JSON; a non-JSON body becomes null', async () => {
  const fetchFn = jest.fn(async () => ({ status: 401, json: async () => ({ error: 'wrong_pin' }) }));
  const deps = createAuthDeps({ client: fakeClient().client, storage: memStore(), supabaseUrl: URL_, anonKey: 'anon', newId: () => 'x', fetchFn: fetchFn as unknown as typeof fetch });
  expect(await deps.post('chukta-login-staff', { pin: '1' })).toEqual({ status: 401, body: { error: 'wrong_pin' } });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${URL_}/functions/v1/chukta-login-staff`);
  expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon', 'Content-Type': 'application/json' });
  const bad = createAuthDeps({ client: fakeClient().client, storage: memStore(), supabaseUrl: URL_, anonKey: 'anon', newId: () => 'x',
    fetchFn: (async () => ({ status: 502, json: async () => { throw new Error('html'); } })) as unknown as typeof fetch });
  expect(await bad.post('login', {})).toEqual({ status: 502, body: null });
});

test('getSession distinguishes a definite "no session" from a retryable network failure', async () => {
  const none = createAuthDeps({ client: fakeClient({ getSession: async () => ({ data: { session: null }, error: null }) }).client,
    storage: memStore(), supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  expect(await none.getSession()).toEqual({ hasSession: false, retryableError: false });
  const offline = createAuthDeps({ client: fakeClient({ getSession: async () => ({ data: { session: null }, error: new AuthRetryableFetchError('offline', 0) }) }).client,
    storage: memStore(), supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  expect(await offline.getSession()).toEqual({ hasSession: false, retryableError: true });
});

test('setSession, local sign-out and stored-session key', async () => {
  const store = memStore();
  store.m.set('sb-mhtqufyaxpunhenqropn-auth-token', '{}');
  const { client, calls } = fakeClient();
  const deps = createAuthDeps({ client, storage: store, supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  await deps.setSession('acc', 'ref');
  await deps.signOutLocal();
  await deps.clearStoredSession();
  expect(calls).toEqual(['set:acc:ref', 'signOut:local']);
  expect(store.m.has('sb-mhtqufyaxpunhenqropn-auth-token')).toBe(false);
  expect(projectRef(URL_)).toBe('mhtqufyaxpunhenqropn');
});

test('setSession throws when supabase rejects the tokens', async () => {
  const deps = createAuthDeps({ client: fakeClient({ setSession: async () => ({ error: new Error('bad jwt') }) }).client,
    storage: memStore(), supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  await expect(deps.setSession('a', 'b')).rejects.toThrow('bad jwt');
});

test('identity round-trips; garbage is ignored; null removes it', async () => {
  const store = memStore();
  const deps = createAuthDeps({ client: fakeClient().client, storage: store, supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  const staff = { kind: 'staff' as const, userId: 'u', staffId: 's', staffName: 'M', propertyId: 'p', propertyName: 'Main' };
  await deps.saveIdentity(staff);
  expect(await deps.loadIdentity()).toEqual(staff);
  await deps.saveIdentity(null);
  expect(store.m.has(IDENTITY_KEY)).toBe(false);
  expect(parseIdentity('{"kind":"owner"}')).toBeNull();
  expect(parseIdentity('not json')).toBeNull();
  expect(parseIdentity('{"kind":"owner","userId":"u","shopId":"s","phone":"+91"}')).toEqual({ kind: 'owner', userId: 'u', shopId: 's', phone: '+91' });
});

test('deviceId is created once and reused', async () => {
  const store = memStore();
  let n = 0;
  const deps = createAuthDeps({ client: fakeClient().client, storage: store, supabaseUrl: URL_, anonKey: 'a', newId: () => `dev-${++n}` });
  expect(await deps.deviceId()).toBe('dev-1');
  expect(await deps.deviceId()).toBe('dev-1');
  expect(store.m.get(DEVICE_ID_KEY)).toBe('dev-1');
});
