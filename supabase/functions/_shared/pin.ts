const ITERATIONS = 100_000
const DEFAULT_AUTH_EMAIL_DOMAIN = 'accounts.pragatibandhu.internal'

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin)
}

export async function hashPin(
  pin: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return { hash: toB64(new Uint8Array(bits)), salt: toB64(salt) }
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  let saltBytes: Uint8Array
  try {
    saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  if (saltBytes.length !== 16) return false
  const { hash: computed } = await hashPin(pin, saltBytes)
  if (computed.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}

/** Password for hidden staff auth users; never stored or shown — staff sign in via PIN + server-side magic link. */
export function randomPassword(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(32)))
}

export function staffAuthEmail(staffId: string, domain?: string): string {
  const d = domain ?? Deno.env.get('AUTH_EMAIL_DOMAIN') ?? DEFAULT_AUTH_EMAIL_DOMAIN
  return `st-${staffId}@${d}`
}
