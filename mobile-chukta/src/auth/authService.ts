import type { Identity } from './identity';

export type AuthErrorKey =
  | 'auth.error.invalidCredentials' | 'auth.error.passwordResetRequired' | 'auth.error.notSubscribed'
  | 'auth.error.wrongPin' | 'auth.error.tooManyAttempts' | 'auth.error.ambiguousPin'
  | 'auth.error.staffNotSubscribed' | 'auth.error.network' | 'auth.error.unknown';

export class AuthError extends Error {
  constructor(public key: AuthErrorKey) {
    super(key);
  }
}

export interface AuthDeps {
  post(path: string, body: unknown): Promise<{ status: number; body: any }>;
  setSession(access: string, refresh: string): Promise<void>;
  getSession(): Promise<{ hasSession: boolean; retryableError: boolean }>;
  signOutLocal(): Promise<void>;
  clearStoredSession(): Promise<void>;
  saveIdentity(i: Identity | null): Promise<void>;
  loadIdentity(): Promise<Identity | null>;
  deviceId(): Promise<string>;
}

const OWNER_ERRORS: Record<string, AuthErrorKey> = {
  'Invalid phone number or password': 'auth.error.invalidCredentials',
  password_reset_required: 'auth.error.passwordResetRequired',
  not_subscribed: 'auth.error.notSubscribed',
};
const STAFF_ERRORS: Record<string, AuthErrorKey> = {
  wrong_pin: 'auth.error.wrongPin',
  too_many_attempts: 'auth.error.tooManyAttempts',
  ambiguous_pin: 'auth.error.ambiguousPin',
  not_subscribed: 'auth.error.staffNotSubscribed',
};

export function createAuthService(deps: AuthDeps, timeoutMs = 3000) {
  async function call(path: string, body: unknown, errors: Record<string, AuthErrorKey>) {
    let res: { status: number; body: any };
    try {
      res = await deps.post(path, body);
    } catch {
      throw new AuthError('auth.error.network');
    }
    if (res.status !== 200) throw new AuthError(errors[res.body?.error] ?? 'auth.error.unknown');
    if (typeof res.body?.session?.access_token !== 'string' || typeof res.body?.session?.refresh_token !== 'string') throw new AuthError('auth.error.unknown');
    await deps.setSession(res.body.session.access_token, res.body.session.refresh_token);
    return res.body;
  }

  return {
    async loginOwner(phone10: string, password: string): Promise<Identity> {
      const body = await call('login', { phone: `+91${phone10}`, password, app: 'chukta', deviceId: await deps.deviceId() }, OWNER_ERRORS);
      if (typeof body.session?.user?.id !== 'string' || typeof body.shop?.id !== 'string') throw new AuthError('auth.error.unknown');
      const identity: Identity = { kind: 'owner', userId: body.session.user.id, shopId: body.shop.id, phone: body.shop.phone };
      await deps.saveIdentity(identity);
      return identity;
    },

    async loginStaff(ownerPhone10: string, pin: string): Promise<Identity> {
      const body = await call('chukta-login-staff', { ownerPhone: `+91${ownerPhone10}`, pin, deviceId: await deps.deviceId() }, STAFF_ERRORS);
      if (typeof body.session?.user?.id !== 'string' || typeof body.staff?.id !== 'string' || typeof body.property?.id !== 'string') throw new AuthError('auth.error.unknown');
      const identity: Identity = {
        kind: 'staff', userId: body.session.user.id, staffId: body.staff.id, staffName: body.staff.name,
        propertyId: body.property.id, propertyName: body.property.name,
      };
      await deps.saveIdentity(identity);
      return identity;
    },

    /** Offline-first restore: only a definite "no session" (not a network failure or a timeout) signs the user out. */
    async restore(): Promise<Identity | null> {
      const identity = await deps.loadIdentity();
      if (!identity) return null;
      let timerId: ReturnType<typeof setTimeout> | null = null;
      const check = await Promise.race([
        deps.getSession(),
        new Promise<null>((resolve) => {
          timerId = setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
      if (timerId) clearTimeout(timerId);
      if (check && !check.hasSession && !check.retryableError) {
        await deps.saveIdentity(null);
        return null;
      }
      return identity;
    },

    async logout(): Promise<void> {
      await deps.signOutLocal().catch(() => {});
      await deps.clearStoredSession().catch(() => {});
      await deps.saveIdentity(null);
    },
  };
}
