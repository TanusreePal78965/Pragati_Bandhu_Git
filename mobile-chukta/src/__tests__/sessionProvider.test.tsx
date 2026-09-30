// A revoked session's SIGNED_OUT can legitimately fire more than once (auth-js always emits SIGNED_OUT
// from signOut({ scope: 'local' }), including the one the provider's own onLoggedOut('revoked') handler
// triggers via authService.logout()). onLoggedOut must fire at most once per session end.
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
}));

jest.mock('../db/openDb', () => ({ openChuktaDb: jest.fn() }));

jest.mock('../sync/remote', () => ({
  createSupabaseRemote: jest.fn(() => ({
    write: jest.fn(async () => null),
    fetchSince: jest.fn(async () => ({ rows: [], error: null })),
  })),
}));

jest.mock('../app/services', () => ({
  authService: { logout: jest.fn(async () => {}) },
  staffApi: {},
}));

import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SessionProvider } from '../app/SessionProvider';
import { useSession, type Session } from '../app/session';
import { authService } from '../app/services';
import type { Identity } from '../auth/identity';
import { migrate } from '../db/schema';
import { openChuktaDb } from '../db/openDb';
import { openTestDb } from '../db/testing/betterSqliteDb';
import { supabase } from '../lib/supabase';

const OWNER: Identity = { kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+919800000001' };

beforeEach(() => {
  jest.clearAllMocks();
  (openChuktaDb as jest.Mock).mockImplementation(async () => {
    const db = openTestDb();
    await migrate(db);
    return db;
  });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
});

/** The most recently registered onAuthStateChange callback (the provider re-registers one per mount/identity). */
function authStateCallback(): (event: string) => void {
  const calls = (supabase.auth.onAuthStateChange as jest.Mock).mock.calls;
  return calls[calls.length - 1][0];
}

test('a repeated SIGNED_OUT fires onLoggedOut("revoked") only once', async () => {
  const onLoggedOut = jest.fn();
  render(
    <SessionProvider identity={OWNER} onLoggedOut={onLoggedOut}>
      <Text testID="child">ready</Text>
    </SessionProvider>,
  );
  await screen.findByTestId('child');
  const cb = authStateCallback();
  cb('SIGNED_OUT');
  cb('SIGNED_OUT');
  expect(onLoggedOut).toHaveBeenCalledTimes(1);
  expect(onLoggedOut).toHaveBeenCalledWith('revoked');
});

test('session.logout() fires onLoggedOut("user") once; a SIGNED_OUT during/after it never fires "revoked"', async () => {
  const onLoggedOut = jest.fn();
  let session: Session | null = null;
  function Capture() {
    session = useSession();
    return <Text testID="child">ready</Text>;
  }
  render(
    <SessionProvider identity={OWNER} onLoggedOut={onLoggedOut}>
      <Capture />
    </SessionProvider>,
  );
  await screen.findByTestId('child');
  await session!.logout();
  const cb = authStateCallback();
  cb('SIGNED_OUT');
  expect(authService.logout).toHaveBeenCalledTimes(1);
  expect(onLoggedOut).toHaveBeenCalledTimes(1);
  expect(onLoggedOut).toHaveBeenCalledWith('user');
});

test('a failed session start (database will not open) logs out once instead of spinning forever', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (openChuktaDb as jest.Mock).mockRejectedValue(new Error('cannot open'));
  const onLoggedOut = jest.fn();
  render(
    <SessionProvider identity={OWNER} onLoggedOut={onLoggedOut}>
      <Text testID="child">ready</Text>
    </SessionProvider>,
  );
  await waitFor(() => expect(onLoggedOut).toHaveBeenCalledTimes(1));
  expect(onLoggedOut).toHaveBeenCalledWith('revoked');
  expect(screen.queryByTestId('child')).toBeNull();
  warn.mockRestore();
});
