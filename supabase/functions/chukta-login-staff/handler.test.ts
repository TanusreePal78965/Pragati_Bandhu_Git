import { assertEquals } from 'jsr:@std/assert@1'
import { handleStaffLogin, type StaffCandidate, type StaffLoginDeps } from './handler.ts'
import { hashPin } from '../_shared/pin.ts'

const tok = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`
const NOW = new Date('2026-09-30T10:00:00Z')

async function cand(id: string, pin: string, over: Partial<StaffCandidate> = {}): Promise<StaffCandidate> {
  const h = await hashPin(pin)
  return { id, name: `N-${id}`, property_id: 'p1', property_name: 'Main', auth_user_id: `auth-${id}`, pin_hash: h.hash, pin_salt: h.salt, locked_until: null, ...over }
}

function makeDeps(staff: StaffCandidate[], over: Partial<StaffLoginDeps> = {}) {
  const log: string[] = []
  const deps: StaffLoginDeps = {
    findShopIdByPhone: async (p) => (p === '+919800000001' ? 'shop1' : null),
    listStaffForShop: async () => staff,
    recordFailures: async (ids) => { log.push(`fail:${ids.join(',')}`) },
    resetFailures: async (id) => { log.push(`reset:${id}`) },
    createSession: async (uid) => { log.push(`session:${uid}`); return { access_token: tok({ session_id: 'sess1' }), refresh_token: 'r1' } },
    recordSession: async (sid, uid, dev) => { log.push(`record:${sid}:${uid}:${dev}`) },
    refresh: async () => ({ access_token: tok({ session_id: 'sess1', app: 'chukta', app_role: 'staff' }), refresh_token: 'r2' }),
    now: () => NOW,
    ...over,
  }
  return { deps, log }
}

const input = { ownerPhone: '+919800000001', pin: '4821', deviceId: 'dev1' }

Deno.test('400 on invalid input', async () => {
  const { deps } = makeDeps([])
  assertEquals((await handleStaffLogin({ ownerPhone: '', pin: '4821' }, deps)).status, 400)
  assertEquals((await handleStaffLogin({ ownerPhone: '+91', pin: '12' }, deps)).status, 400)
})

Deno.test('unknown owner phone: 401 wrong_pin, nothing recorded', async () => {
  const { deps, log } = makeDeps([])
  const res = await handleStaffLogin({ ...input, ownerPhone: '+910000000000' }, deps)
  assertEquals(res.body, { error: 'wrong_pin' })
  assertEquals(log, [])
})

Deno.test('wrong pin: 401 and failure recorded for unlocked candidates only', async () => {
  const a = await cand('a', '1111')
  const b = await cand('b', '2222', { locked_until: '2026-09-30T10:05:00Z' })
  const { deps, log } = makeDeps([a, b])
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 401)
  assertEquals(log, ['fail:a'])
})

Deno.test('all candidates locked: 429 too_many_attempts', async () => {
  const a = await cand('a', '4821', { locked_until: '2026-09-30T10:05:00Z' })
  const { deps, log } = makeDeps([a])
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 429)
  assertEquals(res.body.error, 'too_many_attempts')
  assertEquals(log, [])
})

Deno.test('expired lock counts as unlocked', async () => {
  const a = await cand('a', '4821', { locked_until: '2026-09-30T09:00:00Z' })
  const { deps } = makeDeps([a])
  assertEquals((await handleStaffLogin(input, deps)).status, 200)
})

Deno.test('same pin at two properties: 409 ambiguous_pin', async () => {
  const a = await cand('a', '4821')
  const b = await cand('b', '4821', { property_id: 'p2' })
  const { deps } = makeDeps([a, b])
  assertEquals((await handleStaffLogin(input, deps)).body.error, 'ambiguous_pin')
})

Deno.test('match: resets counter, creates + records session, returns refreshed session', async () => {
  const a = await cand('a', '4821')
  const { deps, log } = makeDeps([a, await cand('b', '9999')])
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['reset:a', 'session:auth-a', 'record:sess1:auth-a:dev1'])
  assertEquals((res.body.session as { refresh_token: string }).refresh_token, 'r2')
  assertEquals(res.body.staff, { id: 'a', name: 'N-a' })
  assertEquals(res.body.property, { id: 'p1', name: 'Main' })
})
