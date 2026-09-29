import { assertEquals } from 'jsr:@std/assert@1'
import { handleStaffLogin, type StaffCandidate, type StaffLoginDeps } from './handler.ts'
import { hashPin } from '../_shared/pin.ts'

const tok = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`

async function cand(id: string, pin: string, over: Partial<StaffCandidate> = {}): Promise<StaffCandidate> {
  const h = await hashPin(pin)
  return { id, name: `N-${id}`, property_id: 'p1', property_name: 'Main', auth_user_id: `auth-${id}`, pin_hash: h.hash, pin_salt: h.salt, ...over }
}

function makeDeps(staff: StaffCandidate[], over: Partial<StaffLoginDeps> = {}) {
  const log: string[] = []
  const deps: StaffLoginDeps = {
    findShopIdByPhone: async (p) => (p === '+919800000001' ? 'shop1' : null),
    reserveAttempt: async (s) => { log.push(`reserve:${s}`); return 'ok' },
    clearAttempts: async (s) => { log.push(`clear:${s}`) },
    hasActiveSubscription: async () => true,
    listStaffForShop: async () => { log.push('list'); return staff },
    createSession: async (uid) => { log.push(`session:${uid}`); return { access_token: tok({ session_id: 'sess1' }), refresh_token: 'r1' } },
    recordSession: async (sid, uid, dev) => { log.push(`record:${sid}:${uid}:${dev}`) },
    refresh: async () => ({ access_token: tok({ session_id: 'sess1', app: 'chukta', app_role: 'staff' }), refresh_token: 'r2' }),
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

Deno.test('unknown owner phone: 401 wrong_pin, no attempt reserved', async () => {
  const { deps, log } = makeDeps([])
  const res = await handleStaffLogin({ ...input, ownerPhone: '+910000000000' }, deps)
  assertEquals(res.body, { error: 'wrong_pin' })
  assertEquals(log, [])
})

Deno.test('locked shop: 429 before any staff lookup or PIN work', async () => {
  const { deps, log } = makeDeps([await cand('a', '4821')], { reserveAttempt: async () => 'locked' })
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 429)
  assertEquals(res.body.error, 'too_many_attempts')
  assertEquals(log, [])
})

Deno.test('wrong pin: attempt reserved first, 401, attempts not cleared', async () => {
  const { deps, log } = makeDeps([await cand('a', '1111')])
  assertEquals((await handleStaffLogin(input, deps)).status, 401)
  assertEquals(log, ['reserve:shop1', 'list'])
})

Deno.test('same pin for two staff: 409 ambiguous_pin', async () => {
  const { deps } = makeDeps([await cand('a', '4821'), await cand('b', '4821', { property_id: 'p2' })])
  assertEquals((await handleStaffLogin(input, deps)).body.error, 'ambiguous_pin')
})

Deno.test('match: reserve, list, clear, create + record session, refreshed session returned', async () => {
  const { deps, log } = makeDeps([await cand('a', '4821'), await cand('b', '9999')])
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['reserve:shop1', 'list', 'clear:shop1', 'session:auth-a', 'record:sess1:auth-a:dev1'])
  assertEquals((res.body.session as { refresh_token: string }).refresh_token, 'r2')
  assertEquals(res.body.staff, { id: 'a', name: 'N-a' })
  assertEquals(res.body.property, { id: 'p1', name: 'Main' })
})

Deno.test('correct pin but no active chukta subscription: 403 not_subscribed, attempts cleared, no session', async () => {
  const { deps, log } = makeDeps([await cand('a', '4821')], { hasActiveSubscription: async () => false })
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 403)
  assertEquals(res.body, { error: 'not_subscribed' })
  assertEquals(log, ['reserve:shop1', 'list', 'clear:shop1'])
})

Deno.test('wrong pin never reveals subscription state', async () => {
  let asked = false
  const { deps } = makeDeps([await cand('a', '1111')], { hasActiveSubscription: async () => { asked = true; return false } })
  assertEquals((await handleStaffLogin(input, deps)).body, { error: 'wrong_pin' })
  assertEquals(asked, false)
})
