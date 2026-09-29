import { decodeJwtPayload, type HandlerResult, type Session } from '../_shared/account.ts'
import { isValidPin, verifyPin } from '../_shared/pin.ts'

export type StaffCandidate = {
  id: string
  name: string
  property_id: string
  property_name: string
  auth_user_id: string
  pin_hash: string
  pin_salt: string
}

export interface StaffLoginDeps {
  findShopIdByPhone(phone: string): Promise<string | null>
  /** Atomically reserves one attempt for the shop before any PIN work: 'ok' | 'locked'. */
  reserveAttempt(shopId: string): Promise<'ok' | 'locked'>
  clearAttempts(shopId: string): Promise<void>
  /** The shop's `app_subscriptions` row for chukta exists and is_active (same rule as owner login). */
  hasActiveSubscription(shopId: string): Promise<boolean>
  listStaffForShop(shopId: string): Promise<StaffCandidate[]>
  createSession(authUserId: string): Promise<Session>
  recordSession(sessionId: string, userId: string, deviceId: string | null): Promise<void>
  refresh(refreshToken: string): Promise<Session>
}

const WRONG_PIN: HandlerResult = { status: 401, body: { error: 'wrong_pin' } }

export async function handleStaffLogin(
  input: { ownerPhone?: unknown; pin?: unknown; deviceId?: unknown },
  deps: StaffLoginDeps,
): Promise<HandlerResult> {
  const ownerPhone = typeof input.ownerPhone === 'string' ? input.ownerPhone.trim() : ''
  if (!ownerPhone || !isValidPin(input.pin)) return { status: 400, body: { error: 'ownerPhone and a 4-6 digit pin are required' } }
  const pin = input.pin
  const deviceId = typeof input.deviceId === 'string' ? input.deviceId : null

  const shopId = await deps.findShopIdByPhone(ownerPhone)
  if (!shopId) return WRONG_PIN

  if ((await deps.reserveAttempt(shopId)) === 'locked') return { status: 429, body: { error: 'too_many_attempts' } }

  const staff = await deps.listStaffForShop(shopId)
  const matches: StaffCandidate[] = []
  for (const s of staff) {
    if (await verifyPin(pin, s.pin_hash, s.pin_salt)) matches.push(s)
  }
  if (matches.length === 0) return WRONG_PIN
  if (matches.length > 1) return { status: 409, body: { error: 'ambiguous_pin' } }

  const match = matches[0]
  await deps.clearAttempts(shopId)
  if (!(await deps.hasActiveSubscription(shopId))) return { status: 403, body: { error: 'not_subscribed' } }
  const first = await deps.createSession(match.auth_user_id)
  const sessionId = decodeJwtPayload(first.access_token).session_id
  if (typeof sessionId !== 'string') throw new Error('session_id claim missing from access token')
  await deps.recordSession(sessionId, match.auth_user_id, deviceId)
  const session = await deps.refresh(first.refresh_token)

  return {
    status: 200,
    body: { session, staff: { id: match.id, name: match.name }, property: { id: match.property_id, name: match.property_name } },
  }
}
