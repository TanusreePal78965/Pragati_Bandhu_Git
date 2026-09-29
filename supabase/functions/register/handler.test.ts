import { assertEquals } from 'jsr:@std/assert@1'
import { handleCheckPhone, handleRegister, type RegisterDeps } from './handler.ts'
import type { ShopRow } from '../_shared/account.ts'

const existing: ShopRow = { id: 'shop1', phone: '+919800000001', auth_user_id: 'u1', is_active: true }

function makeDeps(over: Partial<RegisterDeps> = {}) {
  const log: string[] = []
  const deps: RegisterDeps = {
    verifyFirebasePhone: async () => '+919800000001',
    findShopByPhone: async () => null,
    createShop: async (f) => { log.push(`create:${f.shop_name}`); return { id: 'new', phone: f.phone, auth_user_id: null, is_active: true, shop_name: f.shop_name } },
    ensureAuthUser: async (shop) => { log.push(`ensure:${shop.id}`); return 'u-new' },
    checkPassword: async (_shop, pw) => pw === 'right1',
    listApps: async () => [],
    addSubscriptions: async (id, apps, plan) => { log.push(`subs:${id}:${apps.join(',')}:${plan}`) },
    ...over,
  }
  return { deps, log }
}

const base = { idToken: 't', phone: '+919800000001', password: 'right1', shopName: 'S', ownerName: 'O' }

Deno.test('400 when verified phone differs', async () => {
  const { deps } = makeDeps({ verifyFirebasePhone: async () => '+919899999999' })
  assertEquals((await handleRegister(base, deps)).status, 400)
})

Deno.test('400 when password shorter than 6', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleRegister({ ...base, password: '123' }, deps)).status, 400)
})

Deno.test('400 when plan is not monthly or yearly', async () => {
  const { deps } = makeDeps()
  const res = await handleRegister({ ...base, plan: 'weekly' }, deps)
  assertEquals(res.status, 400)
  assertEquals(res.body, { error: 'plan must be monthly or yearly' })
})

Deno.test('new phone: creates shop, auth user and subscriptions (default shopai)', async () => {
  const { deps, log } = makeDeps()
  const res = await handleRegister({ ...base, plan: 'yearly' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['create:S', 'ensure:new', 'subs:new:shopai:yearly'])
})

Deno.test('new phone requires shopName and ownerName', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleRegister({ ...base, shopName: '' }, deps)).status, 400)
})

Deno.test('existing phone + wrong password: 401', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => existing })
  assertEquals((await handleRegister({ ...base, password: 'wrong1', apps: ['chukta'] }, deps)).status, 401)
})

Deno.test('existing phone adds only missing apps', async () => {
  const { deps, log } = makeDeps({ findShopByPhone: async () => existing, listApps: async () => ['shopai'] })
  const res = await handleRegister({ ...base, apps: ['shopai', 'chukta'] }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['subs:shop1:chukta:monthly'])
})

Deno.test('existing phone already on every requested app: 409', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => existing, listApps: async () => ['shopai'] })
  const res = await handleRegister({ ...base, apps: ['shopai'] }, deps)
  assertEquals(res.status, 409)
  assertEquals(res.body.error, 'This phone number is already registered')
})

Deno.test('check-phone reports subscribed apps', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => existing, listApps: async () => ['shopai'] })
  assertEquals((await handleCheckPhone({ phone: '+919800000001' }, deps)).body, { exists: true, apps: ['shopai'] })
  const { deps: none } = makeDeps()
  assertEquals((await handleCheckPhone({ phone: '+919800000001' }, none)).body, { exists: false, apps: [] })
})
