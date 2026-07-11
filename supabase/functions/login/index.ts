import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return false

  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
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
  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(bits)))

  // Constant-time comparison.
  if (computedB64.length !== hashB64.length) return false
  let diff = 0
  for (let i = 0; i < computedB64.length; i++) {
    diff |= computedB64.charCodeAt(i) ^ hashB64.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { phone, password } = await req.json()

    if (!phone || !password) {
      return new Response(JSON.stringify({ error: 'phone and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: shop, error } = await supabase
      .from('shops')
      .select('id, password_hash, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active')
      .eq('phone', phone)
      .maybeSingle()

    if (error) throw error

    const invalid = () =>
      new Response(JSON.stringify({ error: 'Invalid phone number or password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    if (!shop || !shop.password_hash) return invalid()

    const ok = await verifyPassword(password, shop.password_hash)
    if (!ok) return invalid()

    const { password_hash: _omit, ...shopWithoutHash } = shop

    return new Response(JSON.stringify({ shop: shopWithoutHash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('login error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
