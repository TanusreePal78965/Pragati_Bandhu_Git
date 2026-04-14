import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getOrCreateUser(e164Phone: string): Promise<string> {
  const { data: existingId, error: rpcError } = await supabase.rpc('get_user_id_by_phone', {
    phone_number: e164Phone,
  })
  if (rpcError) throw rpcError
  if (existingId) return existingId as string

  const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
    phone: e164Phone,
    phone_confirm: true,
  })

  if (!createError) return newUserData.user.id

  // Race condition fallback
  if (createError.message.toLowerCase().includes('already')) {
    const { data: retryId } = await supabase.rpc('get_user_id_by_phone', { phone_number: e164Phone })
    if (retryId) return retryId as string
  }

  throw new Error(createError.message)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: 'phone and otp are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from('otp_tokens')
      .select('otp, expires_at')
      .eq('phone', phone)
      .single()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'OTP not found. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      await supabase.from('otp_tokens').delete().eq('phone', phone)
      return new Response(
        JSON.stringify({ error: 'OTP has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (otp !== tokenData.otp) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const e164Phone = `+91${phone}`
    const userId = await getOrCreateUser(e164Phone)

    // Create a real Supabase session — no JWT secret needed
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({ user_id: userId })
    if (sessionError) {
      console.error('createSession error:', JSON.stringify(sessionError))
      throw new Error(sessionError.message)
    }

    // Consume OTP only after everything succeeds
    await supabase.from('otp_tokens').delete().eq('phone', phone)

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        token_type: 'bearer',
        expires_in: sessionData.session.expires_in,
        user: { id: userId, phone: e164Phone },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('verify-otp unhandled error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
