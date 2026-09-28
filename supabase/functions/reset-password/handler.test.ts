import { assertEquals } from 'jsr:@std/assert@1'
import { handleResetPassword, type ResetDeps } from './handler.ts'

function makeDeps(over: Partial<ResetDeps> = {}) {
  const log: string[] = []
  const deps: ResetDeps = {
    verifyFirebasePhone: async () => '+919800000001',
    findShopByPhone: async () => ({ id: 'shop1', phone: '+919800000001', auth_user_id: null, is_active: true }),
    ensureAuthUser: async (_s, pw) => { log.push(`ensure:${pw}`); return 'u1' },
    revokeAllSessions: async (uid) => { log.push(`revoke:${uid}`) },
    ...over,
  }
  return { deps, log }
}

const body = { idToken: 't', phone: '+919800000001', newPassword: 'newpass1' }

Deno.test('sets the password (creating the auth user for pre-Phase-0 shops) and revokes sessions', async () => {
  const { deps, log } = makeDeps()
  assertEquals((await handleResetPassword(body, deps)).status, 200)
  assertEquals(log, ['ensure:newpass1', 'revoke:u1'])
})

Deno.test('400 on phone mismatch or short password', async () => {
  const { deps } = makeDeps({ verifyFirebasePhone: async () => '+910000000000' })
  assertEquals((await handleResetPassword(body, deps)).status, 400)
  const { deps: d2 } = makeDeps()
  assertEquals((await handleResetPassword({ ...body, newPassword: '123' }, d2)).status, 400)
})

Deno.test('404 for unregistered phone', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => null })
  assertEquals((await handleResetPassword(body, deps)).status, 404)
})
