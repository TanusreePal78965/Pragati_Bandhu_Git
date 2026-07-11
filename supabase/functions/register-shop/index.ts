import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { jwtVerify, createRemoteJWKSet } from 'https://deno.land/x/jose@v5.2.4/index.ts'

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

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const saltB64 = btoa(String.fromCharCode(...salt))
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return `${saltB64}:${hashB64}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { idToken, phone, password, shopName, ownerName, businessCategory, whatsappNumber } = await req.json()

    if (!idToken || !phone || !password || !shopName || !ownerName) {
      return new Response(JSON.stringify({ error: 'idToken, phone, password, shopName and ownerName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!FIREBASE_PROJECT_ID) {
      return new Response(JSON.stringify({ error: 'FIREBASE_PROJECT_ID environment variable is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify Firebase ID Token — proves the caller actually controls `phone`.
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    })

    if (!payload.phone_number || payload.phone_number !== phone) {
      return new Response(JSON.stringify({ error: 'Verified phone number does not match submitted phone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: existing } = await supabase
      .from('shops')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: 'This phone number is already registered' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const passwordHash = await hashPassword(password)

    const { data: shop, error: insertError } = await supabase
      .from('shops')
      .insert({
        shop_name: shopName,
        owner_name: ownerName,
        phone,
        whatsapp_number: whatsappNumber || null,
        business_category: businessCategory || null,
        password_hash: passwordHash,
        is_active: true, // active by default, payment step deferred
      })
      .select('id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active')
      .single()

    if (insertError) throw insertError

    return new Response(JSON.stringify({ shop }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('register-shop error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
