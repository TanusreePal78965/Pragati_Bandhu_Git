import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.2.4/index.ts'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

/** Verifies a Firebase phone-auth ID token and returns its E.164 phone number. */
export async function verifyFirebasePhone(idToken: string): Promise<string> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID environment variable is not configured')
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  if (typeof payload.phone_number !== 'string') throw new Error('No phone number found in token')
  return payload.phone_number
}
