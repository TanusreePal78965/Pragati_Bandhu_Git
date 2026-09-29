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
  locked_until: string | null
}

export interface StaffLoginDeps {
  findShopIdByPhone(phone: string): Promise<string | null>
  /** Active staff of the shop's active properties. */
  listStaffForShop(shopId: string): Promise<StaffCandidate[]>
  recordFailures(staffIds: string[]): Promise<void>
  resetFailures(staffId: string): Promise<void>
  createSession(authUserId: string): Promise<Session>
  recordSession(sessionId: string, userId: string, deviceId: string | null): Promise<void>
  refresh(refreshToken: string): Promise<Session>
  now(): Date
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

  const now = deps.now().getTime()
  const staff = await deps.listStaffForShop(shopId)
  const unlocked = staff.filter((s) => !s.locked_until || new Date(s.locked_until).getTime() <= now)
  if (staff.length > 0 && unlocked.length === 0) return { status: 429, body: { error: 'too_many_attempts' } }

  const matches: StaffCandidate[] = []
  for (const s of unlocked) {
    if (await verifyPin(pin, s.pin_hash, s.pin_salt)) matches.push(s)
  }
  if (matches.length === 0) {
    if (unlocked.length > 0) await deps.recordFailures(unlocked.map((s) => s.id))
    return WRONG_PIN
  }
  if (matches.length > 1) return { status: 409, body: { error: 'ambiguous_pin' } }

  const match = matches[0]
  await deps.resetFailures(match.id)
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
