import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1'
import { hashPin, isValidPin, randomPassword, staffAuthEmail, verifyPin } from './pin.ts'

Deno.test('isValidPin accepts 4-6 digits only', () => {
  assertEquals(['1234', '123456', '0000'].map(isValidPin), [true, true, true])
  assertEquals(['123', '1234567', '12a4', 1234, null].map(isValidPin), [false, false, false, false, false])
})

Deno.test('hashPin/verifyPin round-trip with random salt', async () => {
  const a = await hashPin('4821')
  const b = await hashPin('4821')
  assertNotEquals(a.salt, b.salt)
  assertEquals(await verifyPin('4821', a.hash, a.salt), true)
  assertEquals(await verifyPin('4822', a.hash, a.salt), false)
  assertEquals(await verifyPin('4821', a.hash, 'bad'), false)
})

Deno.test('randomPassword is long and unique', () => {
  const a = randomPassword()
  assert(a.length >= 40)
  assertNotEquals(a, randomPassword())
})

Deno.test('staffAuthEmail uses st- prefix and domain', () => {
  assertEquals(staffAuthEmail('abc', 'd.test'), 'st-abc@d.test')
  assertEquals(staffAuthEmail('abc'), 'st-abc@accounts.pragatibandhu.internal')
})
