import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

/** Loads data from SQLite and reloads whenever the session version or property changes (or `deps` change). */
export function useLocalData<T>(load: (s: Session) => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; reload: () => void } {
  const session = useSession();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    load(session).then(
      (d) => { if (live) { setData(d); setLoading(false); } },
      (e) => { if (live) setLoading(false); console.warn('useLocalData failed', e); },
    );
    return () => { live = false; };
    // `load` is an inline closure; its inputs are listed in deps by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.version, session.propertyId, session.db, tick, ...deps]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, loading, reload };
}

export function useCurrentProperty(): { property: Property | null; loading: boolean } {
  const { data, loading } = useLocalData((s) => (s.propertyId ? getProperty(s.db, s.propertyId) : Promise.resolve(null)));
  return { property: data ?? null, loading };
}
