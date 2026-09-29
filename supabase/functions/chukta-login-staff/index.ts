import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, json, type Session } from '../_shared/account.ts'
import { handleStaffLogin, type StaffLoginDeps } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noPersist)
const publicClient = () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, noPersist)

const deps: StaffLoginDeps = {
  async findShopIdByPhone(phone) {
    const { data, error } = await admin.from('shops').select('id').eq('phone', phone).maybeSingle()
    if (error) throw error
    return data?.id ?? null
  },
  async listStaffForShop(shopId) {
    const { data, error } = await admin.schema('chukta').from('staff_users')
      .select('id, name, property_id, auth_user_id, pin_hash, pin_salt, locked_until, properties!inner(name, shop_id, is_active)')
      .eq('is_active', true)
      .eq('properties.shop_id', shopId)
      .eq('properties.is_active', true)
    if (error) throw error
    return (data ?? []).map((r: Record<string, unknown>) => {
      const p = r.properties as { name: string }
      return {
        id: r.id as string, name: r.name as string, property_id: r.property_id as string, property_name: p.name,
        auth_user_id: r.auth_user_id as string, pin_hash: r.pin_hash as string, pin_salt: r.pin_salt as string,
        locked_until: (r.locked_until as string | null) ?? null,
      }
    })
  },
  async recordFailures(ids) {
    const { error } = await admin.schema('chukta').rpc('record_pin_failure', { p_staff_ids: ids })
    if (error) throw error
  },
  async resetFailures(id) {
    const { error } = await admin.schema('chukta').from('staff_users').update({ failed_attempts: 0, locked_until: null }).eq('id', id)
    if (error) throw error
  },
  async createSession(authUserId) {
    const { data: u, error: uErr } = await admin.auth.admin.getUserById(authUserId)
    if (uErr || !u.user?.email) throw uErr ?? new Error('staff auth user has no email')
    // Server-side one-time link, redeemed immediately; no email is sent and no password is stored.
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
    if (lErr || !link.properties?.hashed_token) throw lErr ?? new Error('generateLink returned no token')
    const { data, error } = await publicClient().auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
    if (error || !data.session) throw error ?? new Error('verifyOtp returned no session')
    return data.session as unknown as Session
  },
  async recordSession(sessionId, userId, deviceId) {
    const { error } = await admin.from('app_sessions').insert({ session_id: sessionId, user_id: userId, app: 'chukta', device_id: deviceId })
    if (error) throw error
  },
  async refresh(refreshToken) {
    const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) throw error ?? new Error('refresh returned no session')
    return data.session as unknown as Session
  },
  now: () => new Date(),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const result = await handleStaffLogin(await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('chukta-login-staff error:', err)
    return json(500, { error: 'Internal error' })
  }
})
