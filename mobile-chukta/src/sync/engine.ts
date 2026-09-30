import type { SqlDb } from '../db/sqlDb';
import { pullAll, type RemoteReader } from './pull';
import { flushPush, type RemoteWriter } from './push';

export type SyncStatus = { running: boolean; lastSyncedAt: string | null; lastError: string | null; pending: number; dead: number };
export const IDLE_STATUS: SyncStatus = { running: false, lastSyncedAt: null, lastError: null, pending: 0, dead: 0 };

export type SyncEngineDeps = {
  db: SqlDb;
  remote: RemoteWriter & RemoteReader;
  hasSession(): Promise<boolean>;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type SyncEngine = {
  run(): Promise<void>;
  runSoon(): void;
  getStatus(): SyncStatus;
  subscribe(fn: (s: SyncStatus) => void): () => void;
  dispose(): void;
};

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 300_000;
const DEBOUNCE_MS = 2_000;

export function backoffDelay(failures: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1), BACKOFF_MAX_MS);
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const now = deps.now ?? (() => new Date());
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const listeners = new Set<(s: SyncStatus) => void>();
  let status: SyncStatus = { ...IDLE_STATUS };
  let inflight: Promise<void> | null = null;
  let again = false;
  let failures = 0;
  let timer: unknown = null;
  let disposed = false;

  const emit = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch };
    for (const l of listeners) {
      // One broken subscriber must not break the pass or starve the others.
      try {
        l(status);
      } catch (e) {
        console.warn('sync listener failed', e);
      }
    }
  };

  function schedule(ms: number) {
    if (disposed) return;
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      run().catch(() => {});
    }, ms);
  }

  async function counts(): Promise<{ pending: number; dead: number }> {
    const r = await deps.db.getFirstAsync<{ pending: number | null; dead: number | null }>(
      "select sum(status = 'pending') as pending, sum(status = 'dead') as dead from sync_queue");
    return { pending: r?.pending ?? 0, dead: r?.dead ?? 0 };
  }

  async function headError(): Promise<string | null> {
    const r = await deps.db.getFirstAsync<{ last_error: string | null }>(
      "select last_error from sync_queue where status = 'pending' order by seq limit 1");
    return r?.last_error ?? null;
  }

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  /**
   * One push + pull. Any throw — including from hasSession(), counts() or headError() — counts as a
   * stall, so the backoff timer is always rescheduled. If counts() fails the previous counts are kept.
   */
  async function pass(): Promise<void> {
    let error: string | null = null;
    let stalled = false;
    let signedOut = false;
    try {
      if (!(await deps.hasSession())) {
        signedOut = true;
      } else {
        const push = await flushPush(deps.db, deps.remote, deps.hasSession);
        stalled = push.stopped;
        await pullAll(deps.db, deps.remote);
      }
    } catch (e) {
      error = message(e);
      stalled = true;
    }
    let c: Partial<SyncStatus> = {};
    try {
      c = await counts();
    } catch (e) {
      error ??= message(e);
      stalled = true;
    }
    if (stalled) {
      failures++;
      schedule(backoffDelay(failures));
      let head: string | null = null;
      if (error === null) {
        try {
          head = await headError();
        } catch (e) {
          head = message(e);
        }
      }
      emit({ ...c, lastError: error ?? head ?? 'sync stalled' });
    } else if (signedOut) {
      emit(c);
    } else {
      failures = 0;
      emit({ ...c, lastError: null, lastSyncedAt: now().toISOString() });
    }
  }

  function run(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (inflight) {
      again = true;
      return inflight;
    }
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    inflight = (async () => {
      try {
        emit({ running: true });
        do {
          again = false;
          await pass();
        } while (again && !disposed);
      } finally {
        inflight = null;
        emit({ running: false });
      }
    })();
    return inflight;
  }

  return {
    run,
    runSoon() {
      if (failures > 0 && timer !== null) return;
      schedule(DEBOUNCE_MS);
    },
    getStatus: () => status,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      listeners.clear();
    },
  };
}
