import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { identityKey, type Identity } from '../auth/identity';
import { openChuktaDb } from '../db/openDb';
import type { SqlDb } from '../db/sqlDb';
import { supabase } from '../lib/supabase';
import { createSyncEngine, IDLE_STATUS, type SyncEngine, type SyncStatus } from '../sync/engine';
import { createSupabaseRemote } from '../sync/remote';
import { Loading } from '../ui/components';
import { authService } from './services';
import { SessionContext, type Session } from './session';

export type LogoutReason = 'user' | 'revoked';
const propertyKey = (i: Identity) => `chukta.property.${identityKey(i)}`;

export function SessionProvider({ identity, onLoggedOut, children }: {
  identity: Identity; onLoggedOut: (reason: LogoutReason) => void; children: ReactNode;
}) {
  const [ready, setReady] = useState<{ db: SqlDb; engine: SyncEngine } | null>(null);
  const [propertyId, setPropertyIdState] = useState<string | null>(identity.kind === 'staff' ? identity.propertyId : null);
  const [version, setVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(IDLE_STATUS);
  // True once the session is ending for any reason (user logout or a revoked SIGNED_OUT), so a later
  // SIGNED_OUT — e.g. the one auth-js always emits from signOut({ scope: 'local' }) during a revoked
  // logout — can never fire onLoggedOut a second time while this provider is still mounted.
  const ending = useRef(false);
  const onLoggedOutRef = useRef(onLoggedOut);
  onLoggedOutRef.current = onLoggedOut;

  useEffect(() => {
    let disposed = false;
    let engine: SyncEngine | null = null;
    let dbToClose: SqlDb | null = null;
    const cleanups: (() => void)[] = [];
    (async () => {
      const db = await openChuktaDb(identityKey(identity));
      dbToClose = db;
      if (identity.kind === 'owner') {
        const saved = await AsyncStorage.getItem(propertyKey(identity));
        if (!disposed) setPropertyIdState(saved);
      }
      if (disposed) return;
      const e = createSyncEngine({
        db, remote: createSupabaseRemote(supabase), hasSession: async () => !!(await supabase.auth.getSession()).data.session,
      });
      engine = e;
      cleanups.push(e.subscribe((s) => {
        setSyncStatus(s);
        if (!s.running) setVersion((v) => v + 1);
      }));
      cleanups.push(NetInfo.addEventListener((s) => { if (s.isConnected) void e.run(); }));
      const appState = AppState.addEventListener('change', (s) => { if (s === 'active') void e.run(); });
      cleanups.push(() => appState.remove());
      // A revoked session (staff deactivated, PIN changed, property archived) fails its next refresh → SIGNED_OUT.
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && !ending.current) {
          ending.current = true;
          onLoggedOutRef.current('revoked');
        }
      });
      cleanups.push(() => data.subscription.unsubscribe());
      setReady({ db, engine: e });
      void e.run();
    })().catch((err) => {
      console.warn('session start failed', err);
      // Without a database there is nothing to show; send the user back to login instead of a
      // spinner that never ends.
      if (disposed || ending.current) return;
      ending.current = true;
      onLoggedOutRef.current('revoked');
    });
    return () => {
      disposed = true;
      cleanups.forEach((c) => c());
      engine?.dispose();
      // Releases the SQLite file handle on logout or identity switch, so it isn't left open for
      // the lifetime of the app.
      dbToClose?.closeAsync?.().catch(() => {});
    };
  }, [identity]);

  const setPropertyId = useCallback(async (id: string | null) => {
    if (identity.kind !== 'owner') return;
    if (id) await AsyncStorage.setItem(propertyKey(identity), id);
    else await AsyncStorage.removeItem(propertyKey(identity));
    setPropertyIdState(id);
  }, [identity]);

  const session = useMemo<Session | null>(() => {
    if (!ready) return null;
    const { db, engine } = ready;
    return {
      identity,
      db,
      repo: { db, userId: identity.userId, role: identity.kind, now: () => new Date(), newId: () => Crypto.randomUUID() },
      propertyId,
      setPropertyId,
      version,
      syncStatus,
      runSync: () => engine.run(),
      afterWrite: () => {
        setVersion((v) => v + 1);
        engine.runSoon();
      },
      logout: async () => {
        ending.current = true;
        await authService.logout();
        onLoggedOutRef.current('user');
      },
    };
  }, [ready, identity, propertyId, setPropertyId, version, syncStatus]);

  if (!session) return <Loading />;
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
