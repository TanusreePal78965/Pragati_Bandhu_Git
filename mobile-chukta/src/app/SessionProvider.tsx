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
  const loggingOut = useRef(false);
  const onLoggedOutRef = useRef(onLoggedOut);
  onLoggedOutRef.current = onLoggedOut;

  useEffect(() => {
    let disposed = false;
    let engine: SyncEngine | null = null;
    const cleanups: (() => void)[] = [];
    (async () => {
      const db = await openChuktaDb(identityKey(identity));
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
        if (event === 'SIGNED_OUT' && !loggingOut.current) onLoggedOutRef.current('revoked');
      });
      cleanups.push(() => data.subscription.unsubscribe());
      setReady({ db, engine: e });
      void e.run();
    })().catch((err) => console.warn('session start failed', err));
    return () => {
      disposed = true;
      cleanups.forEach((c) => c());
      engine?.dispose();
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
        loggingOut.current = true;
        await authService.logout();
        onLoggedOutRef.current('user');
      },
    };
  }, [ready, identity, propertyId, setPropertyId, version, syncStatus]);

  if (!session) return <Loading />;
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
