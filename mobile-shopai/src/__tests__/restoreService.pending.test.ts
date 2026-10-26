describe('restoreFromCloud pending protection', () => {
  beforeEach(() => jest.resetModules());

  it('skips ids pending before the fetch even if they flushed before the import', async () => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      range: () => builder,
      single: () => Promise.resolve({ data: null, error: null }),
      then: (res: any, rej: any) => Promise.resolve({ data: [], error: null }).then(res, rej),
    };
    const from = jest.fn(() => builder);
    jest.doMock('../lib/supabase', () => ({ supabase: { from } }));
    jest.doMock('../utils/storage', () => ({
      getStoredShopId: jest.fn().mockResolvedValue('shop1'),
    }));
    // Before the fetch: P (a DELTA) and C are queued. During the fetch P's DELTA flushes,
    // so the after-snapshot only has C plus a newly queued Q.
    const getPendingIds = jest
      .fn()
      .mockReturnValueOnce({ products: new Set(['P']), customers: new Set(['C']) })
      .mockReturnValueOnce({ customers: new Set(['C']), products: new Set(['Q']) });
    const flushedDuringPull = { products: new Set(['F']) };
    jest.doMock('../db/syncQueue', () => ({ getPendingIds, beginPullTracking: () => () => flushedDuringPull }));
    const importFromJson = jest.fn().mockReturnValue({});
    jest.doMock('../db/backup', () => ({ importFromJson, snapshotLocalIds: () => ({ products: new Set(['P']) }) }));

    const { restoreFromCloud } = require('../services/restoreService');
    const result = await restoreFromCloud();

    expect(result.success).toBe(true);
    expect(getPendingIds).toHaveBeenCalledTimes(2);
    expect(getPendingIds.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0]);
    const { pending } = importFromJson.mock.calls[0][1];
    expect([...pending.products].sort()).toEqual(['F', 'P', 'Q']);
    expect([...importFromJson.mock.calls[0][1].reconcileOnly.products]).toEqual(['P']);
    expect([...pending.customers]).toEqual(['C']);
  });
});
