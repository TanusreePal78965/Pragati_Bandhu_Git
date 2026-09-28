import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { authEmailForShop, type ShopRow } from './account.ts'

/** Narrow port over the admin API so the linking logic is unit-testable. */
export interface AdminAuthPort {
  updatePassword(userId: string, password: string): Promise<void>
  createUser(attrs: { email: string; password: string; phone: string }): Promise<string>
  linkShop(shopId: string, userId: string): Promise<void>
}

/** Returns the shop's auth user id, creating and linking one if the shop has none, and sets its password. */
export async function ensureAuthUser(
  port: AdminAuthPort,
  shop: Pick<ShopRow, 'id' | 'phone' | 'auth_user_id'>,
  password: string,
  emailDomain?: string,
): Promise<string> {
  if (shop.auth_user_id) {
    await port.updatePassword(shop.auth_user_id, password)
    return shop.auth_user_id
  }
  const userId = await port.createUser({ email: authEmailForShop(shop.id, emailDomain), password, phone: shop.phone })
  await port.linkShop(shop.id, userId)
  return userId
}

export function adminAuthPort(admin: SupabaseClient): AdminAuthPort {
  return {
    async updatePassword(userId, password) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) throw error
    },
    async createUser({ email, password, phone }) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phone } })
      if (error || !data.user) throw error ?? new Error('createUser returned no user')
      return data.user.id
    },
    async linkShop(shopId, userId) {
      const { error } = await admin.from('shops').update({ auth_user_id: userId }).eq('id', shopId)
      if (error) throw error
    },
  }
}
