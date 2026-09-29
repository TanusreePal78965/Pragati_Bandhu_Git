import { assertEquals } from 'jsr:@std/assert@1'
import { type AdminAuthPort, ensureAuthUser } from './authUsers.ts'

function fakePort() {
  const calls: string[] = []
  const port: AdminAuthPort = {
    async updatePassword(id, pw) { calls.push(`update:${id}:${pw}`) },
    async createUser({ email }) { calls.push(`create:${email}`); return 'new-user-id' },
    async linkShop(shopId, userId) { calls.push(`link:${shopId}:${userId}`) },
  }
  return { port, calls }
}

Deno.test('linked shop only gets its password updated', async () => {
  const { port, calls } = fakePort()
  assertEquals(await ensureAuthUser(port, { id: 'shop1', phone: '+91', auth_user_id: 'u1' }, 'pw'), 'u1')
  assertEquals(calls, ['update:u1:pw'])
})

Deno.test('unlinked shop gets a new auth user keyed by shop id, then linked', async () => {
  const { port, calls } = fakePort()
  assertEquals(await ensureAuthUser(port, { id: 'shop2', phone: '+91', auth_user_id: null }, 'pw', 'd.test'), 'new-user-id')
  assertEquals(calls, ['create:s-shop2@d.test', 'link:shop2:new-user-id'])
})
