import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, json, type Session } from '../_shared/account.ts'
import { handleLogin, type LoginDeps } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noPersist)
const publicClient = () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, noPersist)

const SHOP_COLUMNS =
  'id, auth_user_id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active'

const deps: LoginDeps = {
  async findShopByPhone(phone) {
    const { data, error } = await admin.from('shops').select(SHOP_COLUMNS).eq('phone', phone).maybeSingle()
    if (error) throw error
    return data
  },
  async getAuthEmail(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    return error ? null : data.user?.email ?? null
  },
  async signIn(email, password) {
    const { data, error } = await publicClient().auth.signInWithPassword({ email, password })
    return error ? null : (data.session as unknown as Session | null)
  },
  async getSubscription(shopId, app) {
    const { data, error } = await admin.from('app_subscriptions')
      .select('app, plan_type, is_active, expires_at').eq('shop_id', shopId).eq('app', app).maybeSingle()
    if (error) throw error
    return data
  },
  async recordSession(sessionId, userId, app, deviceId) {
    const { error } = await admin.from('app_sessions').insert({ session_id: sessionId, user_id: userId, app, device_id: deviceId })
    if (error) throw error
  },
  async refresh(refreshToken) {
    const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) throw error ?? new Error('refresh returned no session')
    return data.session as unknown as Session
  },
  async revoke(accessToken) {
    await admin.auth.admin.signOut(accessToken, 'local')
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const result = await handleLogin(await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('login error:', err)
    return json(500, { error: 'Internal error' })
  }
})
