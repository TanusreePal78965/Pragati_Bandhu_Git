import { assertEquals } from 'jsr:@std/assert@1'
import { extendExpiry } from './expiry.ts'

const now = new Date('2026-09-28T00:00:00Z')

Deno.test('extends from current expiry when still active', () => {
  assertEquals(extendExpiry('2026-10-10T00:00:00Z', 30, now), '2026-11-09T00:00:00.000Z')
})

Deno.test('extends from now when expired or missing', () => {
  assertEquals(extendExpiry('2026-01-01T00:00:00Z', 30, now), '2026-10-28T00:00:00.000Z')
  assertEquals(extendExpiry(null, 365, now), '2027-09-28T00:00:00.000Z')
})
