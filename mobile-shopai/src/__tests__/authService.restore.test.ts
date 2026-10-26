import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('autoRestoreIfEmpty', () => {
  let testDb: TestDb;
  let svc: typeof import('../services/authService');
  let restoreFromCloud: jest.Mock;
  let events: string[];
  let consent: boolean;

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    consent = true;
    events = [];
    restoreFromCloud = jest.fn().mockResolvedValue({ success: true });
    jest.doMock('../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn() } }));
    jest.doMock('@supabase/supabase-js', () => ({ isAuthRetryableFetchError: () => false }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: { removeItem: jest.fn() },
    }));
    jest.doMock('../utils/storage', () => ({
      clearAllUserData: jest.fn(),
      getShopInfo: jest.fn(),
      setShopInfo: jest.fn(),
      setHasConsent: jest.fn(),
      getHasConsent: jest.fn(async () => consent),
      getOrCreateDeviceId: jest.fn(),
      storeShopSession: jest.fn(),
      getStoredShopId: jest.fn(),
    }));
    jest.doMock('../services/restoreService', () => ({ restoreFromCloud }));
    jest.doMock('../utils/restoreEvents', () => ({
      emitRestoreEvent: (e: string) => events.push(e),
    }));
    svc = require('../services/authService');
  });

  it('restores when consent and products empty', async () => {
    await svc.autoRestoreIfEmpty();
    expect(restoreFromCloud).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['start', 'complete']);
  });

  it('does nothing when products exist', async () => {
    testDb.runSync("INSERT INTO products (id, name) VALUES ('p1', 'x')");
    await svc.autoRestoreIfEmpty();
    expect(restoreFromCloud).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('does nothing without consent', async () => {
    consent = false;
    await svc.autoRestoreIfEmpty();
    expect(restoreFromCloud).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('emits error when restore returns success:false', async () => {
    restoreFromCloud.mockResolvedValue({ success: false, error: 'boom' });
    await svc.autoRestoreIfEmpty();
    expect(events).toEqual(['start', 'error']);
  });

  it('emits error when restore throws', async () => {
    restoreFromCloud.mockRejectedValue(new Error('x'));
    await svc.autoRestoreIfEmpty();
    expect(events).toEqual(['start', 'error']);
  });

  it('does nothing when this device is in conflict', async () => {
    require('../services/deviceLock').setDeviceConflict(true);
    await svc.autoRestoreIfEmpty();
    expect(restoreFromCloud).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});
