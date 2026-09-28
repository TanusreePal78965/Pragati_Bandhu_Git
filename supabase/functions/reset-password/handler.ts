import type { HandlerResult, ShopRow } from '../_shared/account.ts'

export interface ResetDeps {
  verifyFirebasePhone(idToken: string): Promise<string>
  findShopByPhone(phone: string): Promise<ShopRow | null>
  ensureAuthUser(shop: ShopRow, password: string): Promise<string>
  revokeAllSessions(userId: string): Promise<void>
}

export async function handleResetPassword(input: Record<string, unknown>, deps: ResetDeps): Promise<HandlerResult> {
  const idToken = typeof input.idToken === 'string' ? input.idToken : ''
  const phone = typeof input.phone === 'string' ? input.phone : ''
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : ''
  if (!idToken || !phone || !newPassword) return { status: 400, body: { error: 'idToken, phone and newPassword are required' } }
  if (newPassword.length < 6) return { status: 400, body: { error: 'Password must be at least 6 characters' } }

  if ((await deps.verifyFirebasePhone(idToken)) !== phone) {
    return { status: 400, body: { error: 'Verified phone number does not match submitted phone' } }
  }
  const shop = await deps.findShopByPhone(phone)
  if (!shop) return { status: 404, body: { error: 'This phone number is not registered' } }

  // One password for both apps: a reset signs the user out of ShopAI and Chukta everywhere.
  const userId = await deps.ensureAuthUser(shop, newPassword)
  await deps.revokeAllSessions(userId)
  return { status: 200, body: { success: true } }
}
