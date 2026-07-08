import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { jwtVerify, createRemoteJWKSet, SignJWT } from 'https://deno.land/x/jose@v5.2.4/index.ts'

// Wildcard origin is fine here: this endpoint is only ever called from the
// RN mobile app (no browser client), and every request is still gated by a
// verified Firebase idToken + anon apikey — CORS doesn't add real protection
// for a non-browser caller. Tighten this if a web client is ever added.
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

async function findUserIdByEmail(email: string): Promise<string | null> {
  // admin.listUsers() paginates (default page size ~50) — walk all pages so
  // lookups don't silently miss users once the user base grows past one page.
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(u => u.email === email);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page++;
  }
}

async function getOrCreateSupabaseUser(payload: any): Promise<string> {
  const rawPhone = payload.phone_number; // E.164 format (e.g. +919876543210)
  // Only trust the email claim if Firebase/Google verified ownership of it —
  // an unverified email must never be used to match/create an account.
  const email = payload.email_verified ? payload.email : undefined;

  if (!email && !rawPhone) {
    throw new Error('Firebase token must contain a phone_number or a verified email');
  }

  // Look up by phone if phone exists
  if (rawPhone) {
    const { data: userIdByPhone } = await supabase.rpc('get_user_id_by_phone', {
      phone_number: rawPhone,
    });
    if (userIdByPhone) return userIdByPhone;
  }

  // Look up by email if email exists
  if (email) {
    const existingId = await findUserIdByEmail(email);
    if (existingId) return existingId;
  }

  // If no user exists, create a new one in Supabase
  const createParams: any = {
    email_confirm: true,
    phone_confirm: true,
  };
  if (email) createParams.email = email;
  if (rawPhone) createParams.phone = rawPhone;

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser(createParams);
  if (createError) {
    // Concurrent first-login race: another request created the same user
    // between our lookup and this createUser call. Re-resolve instead of failing.
    if (rawPhone) {
      const { data: userIdByPhone } = await supabase.rpc('get_user_id_by_phone', {
        phone_number: rawPhone,
      });
      if (userIdByPhone) return userIdByPhone;
    }
    if (email) {
      const existingId = await findUserIdByEmail(email);
      if (existingId) return existingId;
    }
    throw createError;
  }

  return newUser.user.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return new Response(JSON.stringify({ error: 'idToken is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!FIREBASE_PROJECT_ID) {
      return new Response(JSON.stringify({ error: 'FIREBASE_PROJECT_ID environment variable is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify Firebase ID Token
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    // Get or Create user in Supabase
    const userId = await getOrCreateSupabaseUser(payload);

    // 4. Mint Custom JWT Session
    const supabaseSecret = Deno.env.get('CUSTOM_JWT_SECRET')
    if (!supabaseSecret) {
      throw new Error('CUSTOM_JWT_SECRET is not set')
    }
    const secretKey = new TextEncoder().encode(supabaseSecret)
    const iat = Math.floor(Date.now() / 1000)
    const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 // 24h — client silently re-mints via the still-live Firebase session
    const exp = iat + SESSION_LIFETIME_SECONDS

    const customToken = await new SignJWT({
      role: 'authenticated',
      aud: 'authenticated',
      email: payload.email,
      phone: payload.phone_number,
      app_metadata: { provider: 'firebase', providers: ['firebase'] },
      user_metadata: {},
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .setSubject(userId)
      .sign(secretKey)

    const sessionData = {
      access_token: customToken,
      refresh_token: customToken,
      expires_in: SESSION_LIFETIME_SECONDS,
      token_type: 'bearer',
      user: {
        id: userId,
        email: payload.email,
        phone: payload.phone_number
      }
    }

    return new Response(JSON.stringify(sessionData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('exchange-token error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
