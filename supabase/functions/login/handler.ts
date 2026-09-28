import { type AppName, decodeJwtPayload, type HandlerResult, parseApp, type Session, type ShopRow } from '../_shared/account.ts'

export type Subscription = { app: AppName; plan_type: string; is_active: boolean; expires_at: string | null }

export interface LoginDeps {
  findShopByPhone(phone: string): Promise<ShopRow | null>
  getAuthEmail(userId: string): Promise<string | null>
  signIn(email: string, password: string): Promise<Session | null>
  getSubscription(shopId: string, app: AppName): Promise<Subscription | null>
  recordSession(sessionId: string, userId: string, app: AppName, deviceId: string | null): Promise<void>
  refresh(refreshToken: string): Promise<Session>
  revoke(accessToken: string): Promise<void>
}

const INVALID: HandlerResult = { status: 401, body: { error: 'Invalid phone number or password' } }

export async function handleLogin(
  input: { phone?: unknown; password?: unknown; app?: unknown; deviceId?: unknown },
  deps: LoginDeps,
): Promise<HandlerResult> {
  const phone = typeof input.phone === 'string' ? input.phone : ''
  const password = typeof input.password === 'string' ? input.password : ''
  if (!phone || !password) return { status: 400, body: { error: 'phone and password are required' } }

  const app = parseApp(input.app, 'shopai')
  if (!app) return { status: 400, body: { error: 'unknown app' } }
  const deviceId = typeof input.deviceId === 'string' ? input.deviceId : null

  const shop = await deps.findShopByPhone(phone)
  if (!shop) return INVALID
  // Shops created before Phase 0 have no auth user; the owner sets a password via reset-password.
  if (!shop.auth_user_id) return { status: 401, body: { error: 'password_reset_required' } }

  const email = await deps.getAuthEmail(shop.auth_user_id)
  if (!email) return INVALID
  const first = await deps.signIn(email, password)
  if (!first) return INVALID

  const subscription = await deps.getSubscription(shop.id, app)
  if (!subscription) {
    await deps.revoke(first.access_token)
    return { status: 403, body: { error: 'not_subscribed', app } }
  }

  const sessionId = decodeJwtPayload(first.access_token).session_id
  if (typeof sessionId !== 'string') throw new Error('session_id claim missing from access token')
  await deps.recordSession(sessionId, shop.auth_user_id, app, deviceId)
  // Refresh once so the access token is re-minted through the hook with the app claim.
  const session = await deps.refresh(first.refresh_token)

  const { auth_user_id: _uid, ...publicShop } = shop
  return { status: 200, body: { shop: publicShop, session, subscription } }
}
