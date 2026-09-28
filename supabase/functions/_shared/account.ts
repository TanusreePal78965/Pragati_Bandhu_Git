export type AppName = 'shopai' | 'chukta'
export const APPS: readonly AppName[] = ['shopai', 'chukta']

export type HandlerResult = { status: number; body: Record<string, unknown> }
export type Session = { access_token: string; refresh_token: string; [k: string]: unknown }
export type ShopRow = {
  id: string
  phone: string
  auth_user_id: string | null
  is_active: boolean | null
  [k: string]: unknown
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function parseApp(v: unknown, fallback?: AppName): AppName | null {
  if (v === undefined || v === null || v === '') return fallback ?? null
  return typeof v === 'string' && (APPS as readonly string[]).includes(v) ? (v as AppName) : null
}

export function parseApps(v: unknown, fallback: AppName[]): AppName[] | null {
  if (v === undefined || v === null) return fallback
  if (!Array.isArray(v) || v.length === 0) return null
  const out: AppName[] = []
  for (const item of v) {
    const app = parseApp(item)
    if (!app) return null
    if (!out.includes(app)) out.push(app)
  }
  return out
}

const DEFAULT_AUTH_EMAIL_DOMAIN = 'accounts.pragatibandhu.internal'

/** Auth users are keyed by shop id, never by phone, so a phone change can't collide with another account. */
export function authEmailForShop(shopId: string, domain?: string): string {
  const d = domain ?? (typeof Deno !== 'undefined' ? Deno.env.get('AUTH_EMAIL_DOMAIN') : undefined) ?? DEFAULT_AUTH_EMAIL_DOMAIN
  return `s-${shopId}@${d}`
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1]
  if (!part) throw new Error('malformed jwt')
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
}
