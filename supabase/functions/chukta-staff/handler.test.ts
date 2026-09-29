import { assertEquals } from 'jsr:@std/assert@1'
import { type Caller, handleStaff, type StaffDeps, type StaffRecord } from './handler.ts'
import { hashPin } from '../_shared/pin.ts'

const P1 = '11111111-1111-1111-1111-111111111111'
const P2 = '22222222-2222-2222-2222-222222222222'
const S1 = '33333333-3333-3333-3333-333333333333'
const S2 = '44444444-4444-4444-4444-444444444444'
const S9 = '99999999-9999-9999-9999-999999999999'
const UNKNOWN_STAFF = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

const owner: Caller = { userId: 'u-owner', app: 'chukta', appRole: null, shopId: 'shop1' }

async function staffRow(id: string, pin: string, over: Partial<StaffRecord> = {}): Promise<StaffRecord> {
  const h = await hashPin(pin)
  return { id, property_id: P1, name: id, auth_user_id: `auth-${id}`, pin_hash: h.hash, pin_salt: h.salt, is_active: true, ...over }
}

function makeDeps(over: Partial<StaffDeps> = {}) {
  const log: string[] = []
  const deps: StaffDeps = {
    getCaller: async () => owner,
    getPropertyShop: async (pid) => (pid === P1 ? 'shop1' : pid === P2 ? 'shop2' : null),
    listActiveShopStaff: async () => [],
    getStaff: async () => null,
    createAuthUser: async (email) => { log.push(`auth:${email}`); return 'auth-new' },
    insertStaff: async (row) => { log.push(`insert:${row.id}:${row.name}:${row.auth_user_id}`) },
    updateStaff: async (id, patch) => { log.push(`update:${id}:${Object.keys(patch).sort().join(',')}`) },
    revokeSessions: async (uid) => { log.push(`revoke:${uid}`) },
    deleteAuthUser: async (id) => { log.push(`deleteAuth:${id}`) },
    newId: () => 'st1',
    ...over,
  }
  return { deps, log }
}

Deno.test('create: 401 without a valid caller', async () => {
  const { deps } = makeDeps({ getCaller: async () => null })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: P1, name: 'A', pin: '1234' }, deps)).status, 401)
})

Deno.test('create: 403 for staff callers, shopai tokens, or another shop property', async () => {
  const staffCaller = makeDeps({ getCaller: async () => ({ ...owner, appRole: 'staff' }) })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: P1, name: 'A', pin: '1234' }, staffCaller.deps)).status, 403)
  const shopai = makeDeps({ getCaller: async () => ({ ...owner, app: 'shopai' }) })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: P1, name: 'A', pin: '1234' }, shopai.deps)).status, 403)
  const other = makeDeps()
  assertEquals((await handleStaff('create', 'jwt', { propertyId: P2, name: 'A', pin: '1234' }, other.deps)).status, 403)
})

Deno.test('create: 400 on bad name or pin', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleStaff('create', 'jwt', { propertyId: P1, name: ' ', pin: '1234' }, deps)).status, 400)
  assertEquals((await handleStaff('create', 'jwt', { propertyId: P1, name: 'A', pin: '12' }, deps)).status, 400)
})

Deno.test('create: 400 on invalid propertyId', async () => {
  const { deps, log } = makeDeps()
  const res = await handleStaff('create', 'jwt', { propertyId: 'not-a-uuid', name: 'A', pin: '1234' }, deps)
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'invalid propertyId')
  assertEquals(log, [])
})

Deno.test('create: 409 when an active staff member already uses the pin', async () => {
  const existing = await staffRow('s0', '1234')
  const { deps, log } = makeDeps({ listActiveShopStaff: async () => [existing] })
  const res = await handleStaff('create', 'jwt', { propertyId: P1, name: 'A', pin: '1234' }, deps)
  assertEquals(res.status, 409)
  assertEquals(res.body.error, 'pin_in_use')
  assertEquals(log, [])
})

Deno.test('create: pin must be unique across the whole shop', async () => {
  const other = await staffRow('s0', '1234', { property_id: 'p-other-of-shop1' })
  const { deps } = makeDeps({ listActiveShopStaff: async () => [other] })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: P1, name: 'A', pin: '1234' }, deps)).status, 409)
})

Deno.test('create: creates hidden auth user and staff row', async () => {
  const { deps, log } = makeDeps()
  const res = await handleStaff('create', 'jwt', { propertyId: P1, name: 'Manager', pin: '4821' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['auth:st-st1@accounts.pragatibandhu.internal', 'insert:st1:Manager:auth-new'])
  assertEquals(res.body.staff, { id: 'st1', property_id: P1, name: 'Manager', is_active: true })
})

Deno.test('create: insert failure deletes the orphan auth user', async () => {
  const { deps, log } = makeDeps({ insertStaff: async () => { throw new Error('db down') } })
  let threw = false
  try { await handleStaff('create', 'jwt', { propertyId: P1, name: 'A', pin: '4821' }, deps) } catch { threw = true }
  assertEquals(threw, true)
  assertEquals(log, ['auth:st-st1@accounts.pragatibandhu.internal', 'deleteAuth:auth-new'])
})

Deno.test('update: pin change checks uniqueness excluding self, resets lockout and revokes sessions', async () => {
  const self = await staffRow(S1, '1111')
  const other = await staffRow(S2, '2222')
  const { deps, log } = makeDeps({ getStaff: async () => self, listActiveShopStaff: async () => [self, other] })
  assertEquals((await handleStaff('update', 'jwt', { staffId: S1, pin: '2222' }, deps)).status, 409)
  const res = await handleStaff('update', 'jwt', { staffId: S1, pin: '1111' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, [`update:${S1}:pin_hash,pin_salt`, `revoke:auth-${S1}`])
})

Deno.test('update: deactivation revokes sessions; rename does not', async () => {
  const self = await staffRow(S1, '1111')
  const a = makeDeps({ getStaff: async () => self })
  await handleStaff('update', 'jwt', { staffId: S1, isActive: false }, a.deps)
  assertEquals(a.log, [`update:${S1}:is_active`, `revoke:auth-${S1}`])
  const b = makeDeps({ getStaff: async () => self })
  await handleStaff('update', 'jwt', { staffId: S1, name: 'New' }, b.deps)
  assertEquals(b.log, [`update:${S1}:name`])
})

Deno.test('update: 400 on invalid staffId', async () => {
  const { deps, log } = makeDeps()
  const res = await handleStaff('update', 'jwt', { staffId: 'x' }, deps)
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'invalid staffId')
  assertEquals(log, [])
})

Deno.test('update: 404 unknown staff, 403 staff of another shop', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleStaff('update', 'jwt', { staffId: UNKNOWN_STAFF }, deps)).status, 404)
  const foreign = await staffRow(S9, '9999', { property_id: P2 })
  const f = makeDeps({ getStaff: async () => foreign })
  assertEquals((await handleStaff('update', 'jwt', { staffId: S9, name: 'X' }, f.deps)).status, 403)
})

Deno.test('update: reactivation requires a new unique pin', async () => {
  const inactive = await staffRow(S1, '1111', { is_active: false })
  const { deps, log } = makeDeps({ getStaff: async () => inactive })
  const res = await handleStaff('update', 'jwt', { staffId: S1, isActive: true }, deps)
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'pin_required_to_reactivate')
  const ok = await handleStaff('update', 'jwt', { staffId: S1, isActive: true, pin: '5555' }, deps)
  assertEquals(ok.status, 200)
  assertEquals(log, [`update:${S1}:is_active,pin_hash,pin_salt`, `revoke:auth-${S1}`])
})
