import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, json } from '../_shared/account.ts'
import { adminAuthPort, ensureAuthUser } from '../_shared/authUsers.ts'
import { verifyFirebasePhone } from '../_shared/firebase.ts'
import { handleResetPassword, type ResetDeps } from './handler.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const deps: ResetDeps = {
  verifyFirebasePhone,
  async findShopByPhone(phone) {
    const { data, error } = await admin.from('shops')
      .select('id, phone, auth_user_id, is_active').eq('phone', phone).maybeSingle()
    if (error) throw error
    return data
  },
  ensureAuthUser: (shop, password) => ensureAuthUser(adminAuthPort(admin), shop, password),
  async revokeAllSessions(userId) {
    const { error } = await admin.rpc('revoke_user_sessions', { p_user_id: userId })
    if (error) throw error
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const result = await handleResetPassword(await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('reset-password error:', err)
    return json(500, { error: 'Internal error' })
  }
})
