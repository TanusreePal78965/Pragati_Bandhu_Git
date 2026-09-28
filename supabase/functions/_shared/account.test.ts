import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { authEmailForShop, decodeJwtPayload, parseApp, parseApps } from './account.ts'

Deno.test('parseApp accepts known apps, applies fallback, rejects others', () => {
  assertEquals(parseApp('chukta'), 'chukta')
  assertEquals(parseApp(undefined, 'shopai'), 'shopai')
  assertEquals(parseApp('other', 'shopai'), null)
})

Deno.test('parseApps validates every entry and de-duplicates', () => {
  assertEquals(parseApps(undefined, ['shopai']), ['shopai'])
  assertEquals(parseApps(['chukta', 'shopai', 'chukta'], ['shopai']), ['chukta', 'shopai'])
  assertEquals(parseApps(['nope'], ['shopai']), null)
  assertEquals(parseApps([], ['shopai']), null)
})

Deno.test('authEmailForShop is deterministic and domain-overridable', () => {
  assertEquals(authEmailForShop('abc', 'x.test'), 's-abc@x.test')
  assertEquals(authEmailForShop('abc'), 's-abc@accounts.pragatibandhu.internal')
})

Deno.test('decodeJwtPayload reads base64url payload', () => {
  const payload = btoa(JSON.stringify({ session_id: 's-1' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  assertEquals(decodeJwtPayload(`h.${payload}.sig`).session_id, 's-1')
  assertThrows(() => decodeJwtPayload('garbage'))
})
