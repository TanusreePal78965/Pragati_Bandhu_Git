import { type AppName, type HandlerResult, parseApps, type ShopRow } from '../_shared/account.ts'

export type NewShopFields = {
  shop_name: string
  owner_name: string
  phone: string
  whatsapp_number: string | null
  business_category: string | null
}

export interface RegisterDeps {
  verifyFirebasePhone(idToken: string): Promise<string>
  findShopByPhone(phone: string): Promise<ShopRow | null>
  createShop(fields: NewShopFields): Promise<ShopRow>
  ensureAuthUser(shop: ShopRow, password: string): Promise<string>
  /** Proves the caller knows the existing account's password. False if the shop has no auth user yet. */
  checkPassword(shop: ShopRow, password: string): Promise<boolean>
  listApps(shopId: string): Promise<AppName[]>
  addSubscriptions(shopId: string, apps: AppName[], planType: string): Promise<void>
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function handleRegister(input: Record<string, unknown>, deps: RegisterDeps): Promise<HandlerResult> {
  const idToken = str(input.idToken)
  const phone = str(input.phone)
  const password = typeof input.password === 'string' ? input.password : ''
  const apps = parseApps(input.apps, ['shopai'])
  const plan = str(input.plan) || 'monthly'

  if (!idToken || !phone || !password) return { status: 400, body: { error: 'idToken, phone and password are required' } }
  if (password.length < 6) return { status: 400, body: { error: 'Password must be at least 6 characters' } }
  if (!apps) return { status: 400, body: { error: 'apps must be a non-empty list of shopai/chukta' } }

  if ((await deps.verifyFirebasePhone(idToken)) !== phone) {
    return { status: 400, body: { error: 'Verified phone number does not match submitted phone' } }
  }

  const existing = await deps.findShopByPhone(phone)

  if (!existing) {
    const shopName = str(input.shopName)
    const ownerName = str(input.ownerName)
    if (!shopName || !ownerName) return { status: 400, body: { error: 'shopName and ownerName are required' } }
    const shop = await deps.createShop({
      shop_name: shopName,
      owner_name: ownerName,
      phone,
      whatsapp_number: str(input.whatsappNumber) || null,
      business_category: str(input.businessCategory) || null,
    })
    await deps.ensureAuthUser(shop, password)
    await deps.addSubscriptions(shop.id, apps, plan)
    return { status: 200, body: { shop: { id: shop.id, shop_name: shop.shop_name, phone: shop.phone }, apps } }
  }

  if (!(await deps.checkPassword(existing, password))) {
    return { status: 401, body: { error: 'This number is already registered. Enter its existing password (or reset it) to add the app.' } }
  }
  const current = await deps.listApps(existing.id)
  const missing = apps.filter((a) => !current.includes(a))
  if (missing.length === 0) return { status: 409, body: { error: 'This phone number is already registered', apps: current } }
  await deps.addSubscriptions(existing.id, missing, plan)
  return { status: 200, body: { shop: { id: existing.id, phone: existing.phone }, apps: [...current, ...missing] } }
}

export async function handleCheckPhone(input: Record<string, unknown>, deps: RegisterDeps): Promise<HandlerResult> {
  const phone = str(input.phone)
  if (!phone) return { status: 400, body: { error: 'phone is required' } }
  const shop = await deps.findShopByPhone(phone)
  if (!shop) return { status: 200, body: { exists: false, apps: [] } }
  return { status: 200, body: { exists: true, apps: await deps.listApps(shop.id) } }
}
