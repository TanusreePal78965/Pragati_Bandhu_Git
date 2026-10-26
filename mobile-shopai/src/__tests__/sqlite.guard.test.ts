describe('db proxy guard', () => {
  it('throws before openUserDatabase and works after', () => {
    jest.resetModules();
    const fake = { execSync: jest.fn(), runSync: jest.fn(), getFirstSync: jest.fn(() => ({ user_version: 1 })), closeSync: jest.fn() };
    const openDatabaseSync = jest.fn(() => fake);
    jest.doMock('expo-sqlite', () => ({ openDatabaseSync }));
    const mod = require('../db/sqlite');
    const db = mod.default;
    expect(() => db.runSync).toThrow('Database not opened — call openUserDatabase first');
    expect(openDatabaseSync).not.toHaveBeenCalled();
    mod.openUserDatabase('x');
    expect(() => db.runSync).not.toThrow();
    expect(openDatabaseSync).toHaveBeenCalledWith('shopai_x.db');
  });
});
