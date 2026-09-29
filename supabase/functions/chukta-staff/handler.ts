import type { HandlerResult } from '../_shared/account.ts'
import { hashPin, isValidPin, randomPassword, staffAuthEmail, verifyPin } from '../_shared/pin.ts'

export type Caller = { userId: string; app: string | null; appRole: string | null; shopId: string | null }
export type StaffRecord = {
  id: string
  property_id: string
  name: string
  auth_user_id: string
  pin_hash: string
  pin_salt: string
  is_active: boolean
}
export type StaffPatch = {
  name?: string
  pin_hash?: string
  pin_salt?: string
  is_active?: boolean
}

export interface StaffDeps {
  getCaller(jwt: string): Promise<Caller | null>
  getPropertyShop(propertyId: string): Promise<string | null>
  /** Active staff of all active properties of the shop. */
  listActiveShopStaff(shopId: string): Promise<StaffRecord[]>
  getStaff(staffId: string): Promise<StaffRecord | null>
  createAuthUser(email: string, password: string): Promise<string>
  insertStaff(row: Omit<StaffRecord, 'is_active'>): Promise<void>
  updateStaff(id: string, patch: StaffPatch): Promise<void>
  revokeSessions(authUserId: string): Promise<void>
  deleteAuthUser(authUserId: string): Promise<void>
  newId(): string
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const fail = (status: number, error: string): HandlerResult => ({ status, body: { error } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function pinTaken(pin: string, staff: StaffRecord[], exceptId?: string): Promise<boolean> {
  for (const s of staff) {
    if (s.id !== exceptId && s.is_active && (await verifyPin(pin, s.pin_hash, s.pin_salt))) return true
  }
  return false
}

export async function handleStaff(
  action: 'create' | 'update',
  jwt: string | null,
  input: Record<string, unknown>,
  deps: StaffDeps,
): Promise<HandlerResult> {
  const caller = jwt ? await deps.getCaller(jwt) : null
  if (!caller) return fail(401, 'unauthorized')
  if (caller.app !== 'chukta' || caller.appRole === 'staff' || !caller.shopId) return fail(403, 'forbidden')

  if (action === 'create') {
    const propertyId = str(input.propertyId)
    const name = str(input.name)
    if (!propertyId || !name || !isValidPin(input.pin)) return fail(400, 'propertyId, name and a 4-6 digit pin are required')
    if (!UUID.test(propertyId)) return fail(400, 'invalid propertyId')
    const shop = await deps.getPropertyShop(propertyId)
    if (!shop) return fail(404, 'property_not_found')
    if (shop !== caller.shopId) return fail(403, 'forbidden')
    if (await pinTaken(input.pin, await deps.listActiveShopStaff(caller.shopId))) return fail(409, 'pin_in_use')

    const id = deps.newId()
    const authUserId = await deps.createAuthUser(staffAuthEmail(id), randomPassword())
    const { hash, salt } = await hashPin(input.pin)
    try {
      await deps.insertStaff({ id, property_id: propertyId, name, auth_user_id: authUserId, pin_hash: hash, pin_salt: salt })
    } catch (err) {
      await deps.deleteAuthUser(authUserId).catch(() => {})
      throw err
    }
    return { status: 200, body: { staff: { id, property_id: propertyId, name, is_active: true } } }
  }

  const staffId = str(input.staffId)
  if (!staffId) return fail(400, 'staffId is required')
  if (!UUID.test(staffId)) return fail(400, 'invalid staffId')
  const staff = await deps.getStaff(staffId)
  if (!staff) return fail(404, 'staff_not_found')
  if ((await deps.getPropertyShop(staff.property_id)) !== caller.shopId) return fail(403, 'forbidden')

  if (input.isActive === true && !staff.is_active && !isValidPin(input.pin)) return fail(400, 'pin_required_to_reactivate')

  const patch: StaffPatch = {}
  let revoke = false
  if (input.name !== undefined) {
    const name = str(input.name)
    if (!name) return fail(400, 'name must not be empty')
    patch.name = name
  }
  if (input.pin !== undefined) {
    if (!isValidPin(input.pin)) return fail(400, 'pin must be 4-6 digits')
    if (await pinTaken(input.pin, await deps.listActiveShopStaff(caller.shopId), staff.id)) return fail(409, 'pin_in_use')
    const { hash, salt } = await hashPin(input.pin)
    Object.assign(patch, { pin_hash: hash, pin_salt: salt })
    revoke = true
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') return fail(400, 'isActive must be boolean')
    patch.is_active = input.isActive
    if (!input.isActive) revoke = true
  }
  if (Object.keys(patch).length === 0) return fail(400, 'nothing to update')

  await deps.updateStaff(staff.id, patch)
  if (revoke) await deps.revokeSessions(staff.auth_user_id)
  return {
    status: 200,
    body: { staff: { id: staff.id, property_id: staff.property_id, name: patch.name ?? staff.name, is_active: patch.is_active ?? staff.is_active } },
  }
}
