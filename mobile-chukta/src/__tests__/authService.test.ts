import { AuthError, createAuthService, type AuthDeps } from '../auth/authService';
import type { Identity } from '../auth/identity';

function deps(over: Partial<AuthDeps> = {}) {
  const log: string[] = [];
  let stored: Identity | null = null;
  const d: AuthDeps = {
    post: async () => ({ status: 500, body: {} }),
    setSession: async (a, r) => { log.push(`setSession:${a}:${r}`); },
    getSession: async () => ({ hasSession: true, retryableError: false }),
    signOutLocal: async () => { log.push('signOut'); },
    clearStoredSession: async () => { log.push('clearStored'); },
    saveIdentity: async (i) => { stored = i; log.push(`save:${i ? i.kind : 'null'}`); },
    loadIdentity: async () => stored,
    deviceId: async () => 'dev1',
    ...over,
  };
  return { d, log, setStored: (i: Identity | null) => { stored = i; } };
}

test('loginOwner posts app=chukta with +91 and stores identity', async () => {
  const calls: unknown[] = [];
  const { d, log } = deps({
    post: async (path, body) => {
      calls.push([path, body]);
      return { status: 200, body: { session: { access_token: 'a', refresh_token: 'r', user: { id: 'u1' } }, shop: { id: 'shop1', phone: '+919800000001' } } };
    },
  });
  const id = await createAuthService(d).loginOwner('9800000001', 'secret1');
  expect(calls[0]).toEqual(['login', { phone: '+919800000001', password: 'secret1', app: 'chukta', deviceId: 'dev1' }]);
  expect(id).toEqual({ kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+919800000001' });
  expect(log).toEqual(['setSession:a:r', 'save:owner']);
});

test.each([
  [401, { error: 'Invalid phone number or password' }, 'auth.error.invalidCredentials'],
  [401, { error: 'password_reset_required' }, 'auth.error.passwordResetRequired'],
  [403, { error: 'not_subscribed', app: 'chukta' }, 'auth.error.notSubscribed'],
  [500, { error: 'Internal error' }, 'auth.error.unknown'],
])('loginOwner maps %s %j', async (status, body, key) => {
  const { d } = deps({ post: async () => ({ status, body }) });
  await expect(createAuthService(d).loginOwner('9800000001', 'x')).rejects.toMatchObject({ key });
});

test('loginStaff returns staff identity; maps pin errors', async () => {
  const ok = deps({
    post: async () => ({ status: 200, body: {
      session: { access_token: 'a', refresh_token: 'r', user: { id: 'su' } }, staff: { id: 's1', name: 'Mgr' }, property: { id: 'p1', name: 'Main' } } }),
  });
  expect(await createAuthService(ok.d).loginStaff('9800000001', '4821')).toEqual({
    kind: 'staff', userId: 'su', staffId: 's1', staffName: 'Mgr', propertyId: 'p1', propertyName: 'Main',
  });
  for (const [status, error, key] of [[401, 'wrong_pin', 'auth.error.wrongPin'], [429, 'too_many_attempts', 'auth.error.tooManyAttempts'], [409, 'ambiguous_pin', 'auth.error.ambiguousPin']] as const) {
    const { d } = deps({ post: async () => ({ status, body: { error } }) });
    await expect(createAuthService(d).loginStaff('9800000001', '4821')).rejects.toMatchObject({ key });
  }
});

test('network failure maps to auth.error.network', async () => {
  const { d } = deps({ post: async () => { throw new TypeError('Network request failed'); } });
  const err = await createAuthService(d).loginOwner('9800000001', 'x').catch((e) => e);
  expect(err).toBeInstanceOf(AuthError);
  expect(err.key).toBe('auth.error.network');
});

test('restore: keeps identity offline, clears it when session is truly gone', async () => {
  const owner: Identity = { kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+91' };
  const offline = deps({ getSession: async () => ({ hasSession: false, retryableError: true }) });
  offline.setStored(owner);
  expect(await createAuthService(offline.d).restore()).toEqual(owner);

  const gone = deps({ getSession: async () => ({ hasSession: false, retryableError: false }) });
  gone.setStored(owner);
  expect(await createAuthService(gone.d).restore()).toBeNull();
  expect(gone.log).toContain('save:null');
});

test('restore: a slow getSession times out and keeps the user signed in', async () => {
  const owner: Identity = { kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+91' };
  const slow = deps({ getSession: () => new Promise(() => {}) });
  slow.setStored(owner);
  expect(await createAuthService(slow.d, 20).restore()).toEqual(owner);
});

test('malformed 200 bodies map to auth.error.unknown, never a TypeError', async () => {
  for (const body of [{}, { session: { access_token: 'a', refresh_token: 'r' } }, { session: { access_token: 'a', refresh_token: 'r', user: { id: 'u' } } }]) {
    const { d } = deps({ post: async () => ({ status: 200, body }) });
    await expect(createAuthService(d).loginOwner('9800000001', 'x')).rejects.toMatchObject({ key: 'auth.error.unknown' });
    await expect(createAuthService(d).loginStaff('9800000001', '4821')).rejects.toMatchObject({ key: 'auth.error.unknown' });
  }
});

test('logout signs out locally, clears stored session and identity', async () => {
  const { d, log } = deps();
  await createAuthService(d).logout();
  expect(log).toEqual(['signOut', 'clearStored', 'save:null']);
});

test('staff login: owner shop not subscribed maps to auth.error.staffNotSubscribed', async () => {
  const { d } = deps({ post: async () => ({ status: 403, body: { error: 'not_subscribed' } }) });
  await expect(createAuthService(d).loginStaff('9800000001', '4821')).rejects.toMatchObject({ key: 'auth.error.staffNotSubscribed' });
});
