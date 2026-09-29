import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, decodeJwtPayload, json } from '../_shared/account.ts'
import { handleStaff, type StaffDeps } from './handler.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const chukta = () => admin.schema('chukta')
const STAFF_COLUMNS = 'id, property_id, name, auth_user_id, pin_hash, pin_salt, is_active'

const deps: StaffDeps = {
  async getCaller(jwt) {
    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data.user) return null
    const claims = decodeJwtPayload(jwt)
    return {
      userId: data.user.id,
      app: typeof claims.app === 'string' ? claims.app : null,
      appRole: typeof claims.app_role === 'string' ? claims.app_role : null,
      shopId: typeof claims.shop_id === 'string' ? claims.shop_id : null,
    }
  },
  async getPropertyShop(propertyId) {
    const { data, error } = await chukta().from('properties').select('shop_id').eq('id', propertyId).maybeSingle()
    if (error) throw error
    return data?.shop_id ?? null
  },
  async listActiveStaff(propertyId) {
    const { data, error } = await chukta().from('staff_users').select(STAFF_COLUMNS).eq('property_id', propertyId).eq('is_active', true)
    if (error) throw error
    return data ?? []
  },
  async getStaff(staffId) {
    const { data, error } = await chukta().from('staff_users').select(STAFF_COLUMNS).eq('id', staffId).maybeSingle()
    if (error) throw error
    return data
  },
  async createAuthUser(email, password) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { kind: 'chukta_staff' } })
    if (error || !data.user) throw error ?? new Error('createUser returned no user')
    return data.user.id
  },
  async insertStaff(row) {
    const { error } = await chukta().from('staff_users').insert(row)
    if (error) throw error
  },
  async updateStaff(id, patch) {
    const { error } = await chukta().from('staff_users').update(patch).eq('id', id)
    if (error) throw error
  },
  async revokeSessions(authUserId) {
    const { error } = await admin.rpc('revoke_user_sessions', { p_user_id: authUserId })
    if (error) throw error
  },
  newId: () => crypto.randomUUID(),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const path = new URL(req.url).pathname
    const action = path.endsWith('/create') ? 'create' : path.endsWith('/update') ? 'update' : null
    if (!action || req.method !== 'POST') return json(404, { error: 'not_found' })
    const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    const result = await handleStaff(action, jwt, await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('chukta-staff error:', err)
    return json(500, { error: 'Internal error' })
  }
})
