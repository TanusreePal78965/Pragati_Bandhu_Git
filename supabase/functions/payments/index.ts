import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { jwtVerify, createRemoteJWKSet, SignJWT } from 'https://deno.land/x/jose@v5.2.4/index.ts'
import { parseApp } from '../_shared/account.ts'
import { extendExpiry } from './expiry.ts'

const SHOP_ADMIN_COLUMNS =
  'id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active, active_device_id, created_at, last_synced_at, allow_out_of_stock_billing, auth_user_id'

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

function adminSecretKey() {
  const secret = Deno.env.get('ADMIN_JWT_SECRET')
  if (!secret) throw new Error('Admin auth not configured')
  return new TextEncoder().encode(secret)
}

async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, adminSecretKey())
    if (payload.role !== 'superadmin') throw new Error('Invalid role')
    return true
  } catch (e) {
    if (e instanceof Error && e.message === 'Admin auth not configured') throw e
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
      const { phone, utr, amount, planType, app: rawApp } = await req.json()
      const app = parseApp(rawApp, 'shopai')
      if (!phone || !utr || !amount || !planType || !app) {
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
        app,
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

    // === PUBLIC: LOOKUP (RenewPlan page) ===
    if (path === '/lookup' && req.method === 'POST') {
      const { phone, app: rawApp } = await req.json()
      const app = parseApp(rawApp, 'shopai')
      if (!phone || !app) {
        return new Response(JSON.stringify({ error: 'phone is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: shop } = await supabase.from('shops').select('id, shop_name').eq('phone', phone).maybeSingle()
      if (!shop) {
        return new Response(JSON.stringify({ error: 'Shop not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: sub } = await supabase.from('app_subscriptions').select('expires_at').eq('shop_id', shop.id).eq('app', app).maybeSingle()
      return new Response(JSON.stringify({ shop_name: shop.shop_name, expires_at: sub?.expires_at ?? null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: LOGIN ===
    if (path === '/admin/login' && req.method === 'POST') {
      const { username, password } = await req.json()
      const validUser = Deno.env.get('ADMIN_USERNAME')
      const validPass = Deno.env.get('ADMIN_PASSWORD')
      if (!validUser || !validPass || !Deno.env.get('ADMIN_JWT_SECRET')) {
        return new Response(JSON.stringify({ error: 'Admin auth not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (username !== validUser || password !== validPass) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const token = await new SignJWT({ role: 'superadmin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(adminSecretKey())

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

      const { data: shops, error } = await supabase
        .from('shops')
        .select(`${SHOP_ADMIN_COLUMNS}, app_subscriptions(app, plan_type, is_active, expires_at)`)
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
      const { data: shop, error: shopErr } = await supabase.from('shops').select(`${SHOP_ADMIN_COLUMNS}, app_subscriptions(app, plan_type, is_active, expires_at)`).eq('id', shopId).single()
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

      const body = await req.json().catch(() => ({}))
      const app = parseApp(body.app, 'shopai')
      if (!app) throw new Error('unknown app')
      const { data: sub } = await supabase.from('app_subscriptions')
        .select('expires_at, plan_type').eq('shop_id', shopId).eq('app', app).maybeSingle()
      const newExpiry = extendExpiry(sub?.expires_at ?? null, 30)
      const { error: subErr } = await supabase.from('app_subscriptions').upsert(
        { shop_id: shopId, app, plan_type: sub?.plan_type || 'standard', expires_at: newExpiry, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'shop_id,app' })
      if (subErr) throw subErr
      await supabase.from('shops').update({ is_active: true }).eq('id', shopId)

      return new Response(JSON.stringify({ success: true, newExpiry }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: SET CUSTOM EXPIRY (TESTING OVERRIDE) ===
    if (path.startsWith('/admin/shops/') && path.endsWith('/set-expiry') && req.method === 'POST') {
      const shopId = path.split('/admin/shops/')[1].split('/set-expiry')[0]
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      await verifyAdminToken(token)

      const { plan_expires_at, app: rawApp } = await req.json()
      const app = parseApp(rawApp, 'shopai')
      if (!plan_expires_at || !app) throw new Error('plan_expires_at is required')
      const { error: subErr } = await supabase.from('app_subscriptions')
        .update({ expires_at: plan_expires_at, updated_at: new Date().toISOString() }).eq('shop_id', shopId).eq('app', app)
      if (subErr) throw subErr

      return new Response(JSON.stringify({ success: true, plan_expires_at }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ADMIN: RESET SHOP TEST DATA ===
    if (path.startsWith('/admin/shops/') && path.endsWith('/reset-data') && req.method === 'POST') {
      const shopId = path.split('/admin/shops/')[1].split('/reset-data')[0]
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      const token = authHeader.replace('Bearer ', '')
      await verifyAdminToken(token)

      // 1. Get bill IDs for this shop to delete bill_items safely
      const { data: bills } = await supabase.from('bills').select('id').eq('shop_id', shopId)
      if (bills && bills.length > 0) {
        const billIds = bills.map(b => b.id)
        await supabase.from('bill_items').delete().in('bill_id', billIds)
      }

      // 2. Delete operational data
      await supabase.from('bills').delete().eq('shop_id', shopId)
      await supabase.from('draft_bills').delete().eq('shop_id', shopId)
      await supabase.from('udhar_payments').delete().eq('shop_id', shopId)
      await supabase.from('purchase_log').delete().eq('shop_id', shopId)
      await supabase.from('sales_log').delete().eq('shop_id', shopId)
      await supabase.from('products').delete().eq('shop_id', shopId)
      await supabase.from('categories').delete().eq('shop_id', shopId)
      await supabase.from('brands').delete().eq('shop_id', shopId)
      await supabase.from('customers').delete().eq('shop_id', shopId)
      await supabase.from('notifications').delete().eq('shop_id', shopId)

      return new Response(JSON.stringify({ success: true, message: 'All shop test data reset successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      const app = parseApp(payment.app, 'shopai')!
      const { data: sub } = await supabase.from('app_subscriptions')
        .select('expires_at').eq('shop_id', payment.shop_id).eq('app', app).maybeSingle()
      const newExpiry = extendExpiry(sub?.expires_at ?? null, days)
      const { error: subErr } = await supabase.from('app_subscriptions').upsert(
        { shop_id: payment.shop_id, app, plan_type: payment.plan_type, expires_at: newExpiry, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'shop_id,app' })
      if (subErr) throw subErr
      await supabase.from('shops').update({ is_active: true }).eq('id', payment.shop_id)

      await supabase.from('payments').update({ status: 'success' }).eq('id', paymentId)

      return new Response(JSON.stringify({ success: true, newExpiry }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

    // === ADMIN: SAVE APP SETTINGS (replaces anon REST write from the web) ===
    if (path === '/admin/settings' && req.method === 'POST') {
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      await verifyAdminToken(authHeader.replace('Bearer ', ''))

      const { settings } = await req.json()
      if (!Array.isArray(settings) || settings.some((s) => typeof s?.key !== 'string' || typeof s?.value !== 'string')) {
        return new Response(JSON.stringify({ error: 'settings must be [{ key, value }]' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const now = new Date().toISOString()
      const { error } = await supabase.from('app_settings')
        .upsert(settings.map((s: { key: string; value: string }) => ({ key: s.key, value: s.value, updated_at: now })), { onConflict: 'key' })
      if (error) throw error
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
