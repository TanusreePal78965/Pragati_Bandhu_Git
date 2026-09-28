import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { type AppName, corsHeaders, json } from '../_shared/account.ts'
import { adminAuthPort, ensureAuthUser } from '../_shared/authUsers.ts'
import { verifyFirebasePhone } from '../_shared/firebase.ts'
import { handleCheckPhone, handleRegister, type RegisterDeps } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noPersist)
const publicClient = () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, noPersist)
const TRIAL_DAYS = 30
const SHOP_COLUMNS = 'id, phone, auth_user_id, is_active, shop_name'

const deps: RegisterDeps = {
  verifyFirebasePhone,
  async findShopByPhone(phone) {
    const { data, error } = await admin.from('shops').select(SHOP_COLUMNS).eq('phone', phone).maybeSingle()
    if (error) throw error
    return data
  },
  async createShop(fields) {
    const { data, error } = await admin.from('shops')
      .insert({ ...fields, is_active: true, ai_consent: true }).select(SHOP_COLUMNS).single()
    if (error) throw error
    return data
  },
  ensureAuthUser: (shop, password) => ensureAuthUser(adminAuthPort(admin), shop, password),
  async checkPassword(shop, password) {
    if (!shop.auth_user_id) return false
    const { data: u } = await admin.auth.admin.getUserById(shop.auth_user_id)
    if (!u?.user?.email) return false
    const { data, error } = await publicClient().auth.signInWithPassword({ email: u.user.email, password })
    if (error || !data.session) return false
    await admin.auth.admin.signOut(data.session.access_token, 'local')
    return true
  },
  async listApps(shopId) {
    const { data, error } = await admin.from('app_subscriptions').select('app').eq('shop_id', shopId)
    if (error) throw error
    return (data ?? []).map((r) => r.app as AppName)
  },
  async addSubscriptions(shopId, apps, planType) {
    const expires = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await admin.from('app_subscriptions')
      .insert(apps.map((app) => ({ shop_id: shopId, app, plan_type: planType, expires_at: expires })))
    if (error) throw error
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const body = await req.json()
    const result = new URL(req.url).pathname.endsWith('/check-phone')
      ? await handleCheckPhone(body, deps)
      : await handleRegister(body, deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('register error:', err)
    return json(500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})
