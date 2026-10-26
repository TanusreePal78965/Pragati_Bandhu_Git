describe('syncService handlers and gating', () => {
  let appStateHandler: (s: string) => Promise<void>;
  let netHandler: (s: any) => Promise<void>;
  let flushSyncQueue: jest.Mock;
  let restoreFromCloud: jest.Mock;
  let verifyActiveDevice: jest.Mock;
  let fetchShopStatus: jest.Mock;
  let shopsUpdate: { update: jest.Mock; eq: jest.Mock; is: jest.Mock };
  let svc: typeof import('../services/syncService');

  const tick = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    jest.resetModules();
    flushSyncQueue = jest.fn().mockRejectedValue(new Error('Database not opened'));
    restoreFromCloud = jest.fn().mockResolvedValue({ success: true });
    verifyActiveDevice = jest.fn().mockResolvedValue('ok');
    fetchShopStatus = jest.fn().mockResolvedValue(null);
    const chain: any = {};
    chain.update = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.is = jest.fn(() => Promise.resolve({ error: null }));
    shopsUpdate = chain;
    jest.doMock('react-native', () => ({
      AppState: { addEventListener: jest.fn((_e: string, h: any) => { appStateHandler = h; return { remove: jest.fn() }; }) },
    }));
    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: {
        fetch: jest.fn().mockResolvedValue({ isConnected: true }),
        addEventListener: jest.fn((h: any) => { netHandler = h; return jest.fn(); }),
      },
    }));
    jest.doMock('../db/syncQueue', () => ({ flushSyncQueue }));
    jest.doMock('../utils/storage', () => ({
      getHasConsent: jest.fn().mockResolvedValue(true),
      getShopInfo: jest.fn().mockResolvedValue(null),
      setShopInfo: jest.fn(),
      getOrCreateDeviceId: jest.fn().mockResolvedValue('dev-1'),
      getStoredShopId: jest.fn().mockResolvedValue('shop1'),
    }));
    jest.doMock('../lib/supabase', () => ({ supabase: { from: jest.fn(() => shopsUpdate) } }));
    jest.doMock('../services/restoreService', () => ({ restoreFromCloud }));
    jest.doMock('../services/deviceLock', () => ({ isDeviceConflict: () => false, verifyActiveDevice }));
    jest.doMock('../services/subscription', () => ({ fetchShopStatus, isPlanExpired: () => false }));
    svc = require('../services/syncService');
  });

  afterEach(() => svc.stopSyncService());

  it('handlers swallow a rejecting flush (no unhandled rejection)', async () => {
    await expect(svc.startSyncService(jest.fn(), jest.fn())).resolves.toBeUndefined();
    await expect(appStateHandler('active')).resolves.toBeUndefined();
    await expect(netHandler({ isConnected: true })).resolves.toBeUndefined();
  });

  it('pullIfStale pulls only when the device check says ok', async () => {
    flushSyncQueue.mockResolvedValue(undefined);
    await svc.startSyncService(jest.fn(), jest.fn());
    verifyActiveDevice.mockResolvedValue('unknown');
    await appStateHandler('active');
    await tick();
    expect(restoreFromCloud).not.toHaveBeenCalled();
    verifyActiveDevice.mockResolvedValue('ok');
    await appStateHandler('active');
    await tick();
    expect(restoreFromCloud).toHaveBeenCalledTimes(1);
  });

  it('stamps active_device_id only while it is still null', async () => {
    fetchShopStatus.mockResolvedValue({
      isActive: true, aiConsent: true, activeDeviceId: null, planExpiresAt: null,
    });
    flushSyncQueue.mockResolvedValue(undefined);
    await svc.startSyncService(jest.fn(), jest.fn());
    await tick();
    expect(shopsUpdate.update).toHaveBeenCalledWith({ active_device_id: 'dev-1' });
    expect(shopsUpdate.eq).toHaveBeenCalledWith('id', 'shop1');
    expect(shopsUpdate.is).toHaveBeenCalledWith('active_device_id', null);
  });
});
