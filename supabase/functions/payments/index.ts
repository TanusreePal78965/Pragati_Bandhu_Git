import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { jwtVerify, createRemoteJWKSet, SignJWT } from 'https://deno.land/x/jose@v5.2.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')!
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

async function verifyFirebaseToken(idToken: string) {
  if (!FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID not configured')
  
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  })
  
  if (!payload.phone_number) {
    throw new Error('No phone number found in token')
  }
  return payload.phone_number as string
}

const ADMIN_JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET') || 'super_secret_fallback_key_12345'
const adminSecretKey = new TextEncoder().encode(ADMIN_JWT_SECRET)

async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, adminSecretKey)
    if (payload.role !== 'superadmin') throw new Error('Invalid role')
    return true
  } catch (e) {
    throw new Error('Unauthorized admin token')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/payments')[1] || '/'

    // === INITIATE PAYMENT ===
    if (path === '/initiate' && req.method === 'POST') {
      const { phone, utr, amount, planType } = await req.json()
      if (!phone || !utr || !amount || !planType) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: shop } = await supabase.from('shops').select('id').eq('phone', phone).maybeSingle()
      if (!shop) {
        return new Response(JSON.stringify({ error: 'Shop not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { error } = await supabase.from('payments').insert({
        shop_id: shop.id,
        merchant_transaction_id: utr,
        amount,
        plan_type: planType,
        status: 'pending'
      })

      if (error) {
        if (error.code === '23505') {
          return new Response(JSON.stringify({ error: 'This UTR has already been submitted.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        throw error
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: LOGIN ===
    if (path === '/admin/login' && req.method === 'POST') {
      const { username, password } = await req.json()
      const validUser = Deno.env.get('ADMIN_USERNAME') || 'admin'
      const validPass = Deno.env.get('ADMIN_PASSWORD') || 'admin123'
      
      if (username !== validUser || password !== validPass) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const token = await new SignJWT({ role: 'superadmin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(adminSecretKey)

      return new Response(JSON.stringify({ token }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: PENDING PAYMENTS ===
    if (path === '/admin/pending' && req.method === 'GET') {
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      
      await verifyAdminToken(token)

      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          id,
          merchant_transaction_id,
          amount,
          plan_type,
          status,
          created_at,
          shops (
            id,
            shop_name,
            phone,
            owner_name
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(JSON.stringify(payments), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: DASHBOARD STATS ===
    if (path === '/admin/stats' && req.method === 'GET') {
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      
      await verifyAdminToken(token)

      // 1. Total Shops
      const { count: totalShops } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })

      // 2. Pending Approvals
      const { count: pendingApprovals } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // 3. Approximate Revenue (Sum of 'success' payments)
      const { data: revenueData } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'success')

      const revenue = revenueData ? revenueData.reduce((acc, curr) => acc + (curr.amount || 0), 0) : 0

      return new Response(JSON.stringify({
        totalShops: totalShops || 0,
        pendingApprovals: pendingApprovals || 0,
        revenue
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: ALL SHOPS ===
    if (path === '/admin/shops' && req.method === 'GET') {
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      
      await verifyAdminToken(token)

      // Auto-populate 30-day trial for any existing shops missing plan_expires_at
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('shops')
        .update({ plan_expires_at: expiryDate, plan_type: 'monthly' })
        .is('plan_expires_at', null)

      const { data: shops, error } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(JSON.stringify(shops), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: SHOP DETAILS & METRICS ===
    if (path.startsWith('/admin/shops/') && req.method === 'GET') {
      const shopId = path.split('/admin/shops/')[1]
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      await verifyAdminToken(token)

      // Get basic shop info
      const { data: shop, error: shopErr } = await supabase.from('shops').select('*').eq('id', shopId).single()
      if (shopErr || !shop) throw new Error('Shop not found')

      // Get counts
      const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)
      const { count: customersCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)
      const { count: salesCount } = await supabase.from('bills').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)

      // Get payment history
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({
        shop,
        metrics: {
          products: productsCount || 0,
          customers: customersCount || 0,
          sales: salesCount || 0
        },
        payments: payments || []
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: TOGGLE SHOP STATUS ===
    if (path.startsWith('/admin/shops/') && path.endsWith('/toggle-status') && req.method === 'POST') {
      const shopId = path.split('/admin/shops/')[1].split('/toggle-status')[0]
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      await verifyAdminToken(token)

      const { data: shop } = await supabase.from('shops').select('is_active').eq('id', shopId).single()
      if (!shop) throw new Error('Shop not found')

      await supabase.from('shops').update({ is_active: !shop.is_active }).eq('id', shopId)
      return new Response(JSON.stringify({ success: true, is_active: !shop.is_active }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: EXTEND PLAN ===
    if (path.startsWith('/admin/shops/') && path.endsWith('/extend-plan') && req.method === 'POST') {
      const shopId = path.split('/admin/shops/')[1].split('/extend-plan')[0]
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      await verifyAdminToken(token)

      const { data: shop } = await supabase.from('shops').select('plan_expires_at, plan_type').eq('id', shopId).single()
      if (!shop) throw new Error('Shop not found')

      // Calculate new expiry date
      let currentExpiry = shop.plan_expires_at ? new Date(shop.plan_expires_at) : new Date()
      if (currentExpiry < new Date()) {
        currentExpiry = new Date() // If already expired, start from today
      }
      currentExpiry.setDate(currentExpiry.getDate() + 30)

      await supabase.from('shops').update({ 
        plan_expires_at: currentExpiry.toISOString(),
        plan_type: shop.plan_type || 'standard',
        is_active: true
      }).eq('id', shopId)

      return new Response(JSON.stringify({ success: true, newExpiry: currentExpiry.toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: SET CUSTOM EXPIRY (TESTING OVERRIDE) ===
    if (path.startsWith('/admin/shops/') && path.endsWith('/set-expiry') && req.method === 'POST') {
      const shopId = path.split('/admin/shops/')[1].split('/set-expiry')[0]
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      await verifyAdminToken(token)

      const { plan_expires_at } = await req.json()
      if (!plan_expires_at) throw new Error('plan_expires_at is required')

      await supabase.from('shops').update({ 
        plan_expires_at
      }).eq('id', shopId)

      return new Response(JSON.stringify({ success: true, plan_expires_at }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: APPROVE PAYMENT ===
    if (path.startsWith('/admin/approve/') && req.method === 'POST') {
      const paymentId = path.split('/admin/approve/')[1]
      
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      
      await verifyAdminToken(token)

      const { data: payment } = await supabase.from('payments').select('*').eq('id', paymentId).single()
      if (!payment) throw new Error('Payment not found')
      
      const days = payment.plan_type === 'yearly' ? 365 : 30
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + days)

      await supabase.from('shops').update({
        plan_expires_at: newExpiry.toISOString(),
        plan_type: payment.plan_type,
        is_active: true
      }).eq('id', payment.shop_id)

      await supabase.from('payments').update({ status: 'success' }).eq('id', paymentId)

      return new Response(JSON.stringify({ success: true, newExpiry: newExpiry.toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: REJECT PAYMENT ===
    if (path.startsWith('/admin/reject/') && req.method === 'POST') {
      const paymentId = path.split('/admin/reject/')[1]
      
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      
      await verifyAdminToken(token)

      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId)

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('payments error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
