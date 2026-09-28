import { assertEquals } from 'jsr:@std/assert@1'
import { handleLogin, type LoginDeps } from './handler.ts'
import type { ShopRow } from '../_shared/account.ts'

const tok = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`

const baseShop: ShopRow = { id: 'shop1', phone: '+919800000001', auth_user_id: 'user1', is_active: true, shop_name: 'S' }

function makeDeps(over: Partial<LoginDeps> = {}) {
  const log: string[] = []
  const deps: LoginDeps = {
    findShopByPhone: async () => ({ ...baseShop }),
    getAuthEmail: async () => 's-shop1@d.test',
    signIn: async (_e, pw) => (pw === 'right' ? { access_token: tok({ session_id: 'sess1' }), refresh_token: 'r1' } : null),
    getSubscription: async (_s, app) => ({ app, plan_type: 'monthly', is_active: true, expires_at: null }),
    recordSession: async (sid, uid, app, dev) => { log.push(`record:${sid}:${uid}:${app}:${dev}`) },
    refresh: async () => ({ access_token: tok({ session_id: 'sess1', app: 'shopai' }), refresh_token: 'r2' }),
    revoke: async () => { log.push('revoke') },
    ...over,
  }
  return { deps, log }
}

Deno.test('400 when phone or password missing', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleLogin({ phone: '+91' }, deps)).status, 400)
})

Deno.test('400 for unknown app', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleLogin({ phone: '+91', password: 'right', app: 'x' }, deps)).status, 400)
})

Deno.test('401 generic for unknown phone', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => null })
  assertEquals((await handleLogin({ phone: '+91', password: 'right' }, deps)).body, { error: 'Invalid phone number or password' })
})

Deno.test('401 password_reset_required when shop has no auth user yet', async () => {
  const { deps, log } = makeDeps({ findShopByPhone: async () => ({ ...baseShop, auth_user_id: null }) })
  const res = await handleLogin({ phone: '+91', password: 'right' }, deps)
  assertEquals(res.status, 401)
  assertEquals(res.body.error, 'password_reset_required')
  assertEquals(log, [])
})

Deno.test('401 for wrong password', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleLogin({ phone: '+91', password: 'wrong' }, deps)).status, 401)
})

Deno.test('success records session with app + device and returns refreshed session', async () => {
  const { deps, log } = makeDeps()
  const res = await handleLogin({ phone: '+91', password: 'right', app: 'shopai', deviceId: 'dev1' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['record:sess1:user1:shopai:dev1'])
  assertEquals((res.body.session as { refresh_token: string }).refresh_token, 'r2')
  assertEquals('auth_user_id' in (res.body.shop as Record<string, unknown>), false)
})

Deno.test('missing app defaults to shopai', async () => {
  const { deps, log } = makeDeps()
  await handleLogin({ phone: '+91', password: 'right' }, deps)
  assertEquals(log, ['record:sess1:user1:shopai:null'])
})

Deno.test('no subscription for app: 403 not_subscribed and session revoked', async () => {
  const { deps, log } = makeDeps({ getSubscription: async () => null })
  const res = await handleLogin({ phone: '+91', password: 'right', app: 'chukta' }, deps)
  assertEquals(res.status, 403)
  assertEquals(res.body, { error: 'not_subscribed', app: 'chukta' })
  assertEquals(log, ['revoke'])
})

Deno.test('inactive subscription for app: 403 not_subscribed and session revoked', async () => {
  const { deps, log } = makeDeps({ getSubscription: async (_s, app) => ({ app, plan_type: 'monthly', is_active: false, expires_at: null }) })
  const res = await handleLogin({ phone: '+91', password: 'right', app: 'shopai' }, deps)
  assertEquals(res.status, 403)
  assertEquals(res.body, { error: 'not_subscribed', app: 'shopai' })
  assertEquals(log, ['revoke'])
})

Deno.test('phone with surrounding spaces is trimmed before lookup', async () => {
  let received = ''
  const { deps } = makeDeps({ findShopByPhone: async (phone) => { received = phone; return { ...baseShop } } })
  await handleLogin({ phone: '  +919800000001  ', password: 'right' }, deps)
  assertEquals(received, '+919800000001')
})
