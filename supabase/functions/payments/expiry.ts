/** New expiry = max(current, now) + days. */
export function extendExpiry(current: string | null, days: number, now: Date = new Date()): string {
  const base = current && new Date(current) > now ? new Date(current) : new Date(now)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString()
}
