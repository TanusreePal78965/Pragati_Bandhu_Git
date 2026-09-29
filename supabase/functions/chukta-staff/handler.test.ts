import { assertEquals } from 'jsr:@std/assert@1'
import { type Caller, handleStaff, type StaffDeps, type StaffRecord } from './handler.ts'
import { hashPin } from '../_shared/pin.ts'

const owner: Caller = { userId: 'u-owner', app: 'chukta', appRole: null, shopId: 'shop1' }

async function staffRow(id: string, pin: string, over: Partial<StaffRecord> = {}): Promise<StaffRecord> {
  const h = await hashPin(pin)
  return { id, property_id: 'p1', name: id, auth_user_id: `auth-${id}`, pin_hash: h.hash, pin_salt: h.salt, is_active: true, ...over }
}

function makeDeps(over: Partial<StaffDeps> = {}) {
  const log: string[] = []
  const deps: StaffDeps = {
    getCaller: async () => owner,
    getPropertyShop: async (pid) => (pid === 'p1' ? 'shop1' : pid === 'p2' ? 'shop2' : null),
    listActiveStaff: async () => [],
    getStaff: async () => null,
    createAuthUser: async (email) => { log.push(`auth:${email}`); return 'auth-new' },
    insertStaff: async (row) => { log.push(`insert:${row.id}:${row.name}:${row.auth_user_id}`) },
    updateStaff: async (id, patch) => { log.push(`update:${id}:${Object.keys(patch).sort().join(',')}`) },
    revokeSessions: async (uid) => { log.push(`revoke:${uid}`) },
    newId: () => 'st1',
    ...over,
  }
  return { deps, log }
}

Deno.test('create: 401 without a valid caller', async () => {
  const { deps } = makeDeps({ getCaller: async () => null })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, deps)).status, 401)
})

Deno.test('create: 403 for staff callers, shopai tokens, or another shop property', async () => {
  const staffCaller = makeDeps({ getCaller: async () => ({ ...owner, appRole: 'staff' }) })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, staffCaller.deps)).status, 403)
  const shopai = makeDeps({ getCaller: async () => ({ ...owner, app: 'shopai' }) })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, shopai.deps)).status, 403)
  const other = makeDeps()
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p2', name: 'A', pin: '1234' }, other.deps)).status, 403)
})

Deno.test('create: 400 on bad name or pin', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: ' ', pin: '1234' }, deps)).status, 400)
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '12' }, deps)).status, 400)
})

Deno.test('create: 409 when an active staff member already uses the pin', async () => {
  const existing = await staffRow('s0', '1234')
  const { deps, log } = makeDeps({ listActiveStaff: async () => [existing] })
  const res = await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, deps)
  assertEquals(res.status, 409)
  assertEquals(res.body.error, 'pin_in_use')
  assertEquals(log, [])
})

Deno.test('create: creates hidden auth user and staff row', async () => {
  const { deps, log } = makeDeps()
  const res = await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'Manager', pin: '4821' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['auth:st-st1@accounts.pragatibandhu.internal', 'insert:st1:Manager:auth-new'])
  assertEquals(res.body.staff, { id: 'st1', property_id: 'p1', name: 'Manager', is_active: true })
})

Deno.test('update: pin change checks uniqueness excluding self, resets lockout and revokes sessions', async () => {
  const self = await staffRow('s1', '1111')
  const other = await staffRow('s2', '2222')
  const { deps, log } = makeDeps({ getStaff: async () => self, listActiveStaff: async () => [self, other] })
  assertEquals((await handleStaff('update', 'jwt', { staffId: 's1', pin: '2222' }, deps)).status, 409)
  const res = await handleStaff('update', 'jwt', { staffId: 's1', pin: '1111' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['update:s1:failed_attempts,locked_until,pin_hash,pin_salt', 'revoke:auth-s1'])
})

Deno.test('update: deactivation revokes sessions; rename does not', async () => {
  const self = await staffRow('s1', '1111')
  const a = makeDeps({ getStaff: async () => self })
  await handleStaff('update', 'jwt', { staffId: 's1', isActive: false }, a.deps)
  assertEquals(a.log, ['update:s1:is_active', 'revoke:auth-s1'])
  const b = makeDeps({ getStaff: async () => self })
  await handleStaff('update', 'jwt', { staffId: 's1', name: 'New' }, b.deps)
  assertEquals(b.log, ['update:s1:name'])
})

Deno.test('update: 404 unknown staff, 403 staff of another shop', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleStaff('update', 'jwt', { staffId: 'nope' }, deps)).status, 404)
  const foreign = await staffRow('s9', '9999', { property_id: 'p2' })
  const f = makeDeps({ getStaff: async () => foreign })
  assertEquals((await handleStaff('update', 'jwt', { staffId: 's9', name: 'X' }, f.deps)).status, 403)
})
