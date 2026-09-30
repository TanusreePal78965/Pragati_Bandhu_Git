import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Identity } from '../auth/identity';
import type { SqlDb } from '../db/sqlDb';
import type { Property } from '../domain/types';
import type { RepoContext } from '../repos/context';
import { getProperty } from '../repos/properties';
import type { SyncStatus } from '../sync/engine';
import { todayLocal } from '../utils/dates';

export type Session = {
  identity: Identity;
  db: SqlDb;
  repo: RepoContext;
  /** Owner: the chosen property (null until chosen). Staff: always their own property. */
  propertyId: string | null;
  setPropertyId(id: string | null): Promise<void>;
  /** Bumped after every local write and every finished sync; screens re-read SQLite when it changes. */
  version: number;
  syncStatus: SyncStatus;
  runSync(): Promise<void>;
  /** Call after a local write: re-reads screens and schedules a sync. */
  afterWrite(): void;
  logout(): Promise<void>;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}

export const sessionToday = (s: Session) => todayLocal(s.repo.now());

const sameDeps = (a: unknown[] | null, b: unknown[]) => a !== null && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Loads data from SQLite and reloads whenever the session version or property changes (or `deps` change).
 * A `deps` change (e.g. a different workerId) clears `data` immediately, so a screen never shows the
 * previous answer to a now-different question while the new one loads. A version/sync-driven reload
 * (deps unchanged) keeps showing the last good data until the new load resolves — that's intentional.
 */
export function useLocalData<T>(
  load: (s: Session) => Promise<T>, deps: unknown[] = [],
): { data: T | undefined; error: unknown; loading: boolean; reload: () => void } {
  const session = useSession();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const prevDeps = useRef<unknown[] | null>(null);
  useEffect(() => {
    let live = true;
    if (!sameDeps(prevDeps.current, deps)) setData(undefined);
    prevDeps.current = deps;
    setLoading(true);
    load(session).then(
      (d) => { if (live) { setData(d); setError(null); setLoading(false); } },
      (e) => { if (live) { setError(e); setLoading(false); } console.warn('useLocalData failed', e); },
    );
    return () => { live = false; };
    // `load` is an inline closure; its inputs are listed in deps by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.version, session.propertyId, session.db, tick, ...deps]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

/** Pull-to-refresh state that reflects only the user's own pull, not every background sync. */
export function useManualRefresh(): { refreshing: boolean; onRefresh: () => void } {
  const session = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    session.runSync().finally(() => setRefreshing(false));
  }, [session]);
  return { refreshing, onRefresh };
}

export function useCurrentProperty(): { property: Property | null; loading: boolean } {
  const { data, loading } = useLocalData((s) => (s.propertyId ? getProperty(s.db, s.propertyId) : Promise.resolve(null)));
  return { property: data ?? null, loading };
}
