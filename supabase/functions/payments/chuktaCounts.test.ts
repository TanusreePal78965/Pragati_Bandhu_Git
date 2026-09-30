import { assertEquals } from 'jsr:@std/assert@1'
import { withChuktaCounts } from './chuktaCounts.ts'

Deno.test('attaches counts by shop id; shops without chukta rows get null', () => {
  const shops = [{ id: 's1', shop_name: 'A' }, { id: 's2', shop_name: 'B' }]
  const out = withChuktaCounts(shops, [{ shop_id: 's1', property_count: 2, worker_count: 7 }])
  assertEquals(out, [
    { id: 's1', shop_name: 'A', chukta_counts: { properties: 2, workers: 7 } },
    { id: 's2', shop_name: 'B', chukta_counts: null },
  ])
})

Deno.test('numeric strings from bigint columns become numbers', () => {
  const out = withChuktaCounts([{ id: 's1' }], [{ shop_id: 's1', property_count: '3' as unknown as number, worker_count: '12' as unknown as number }])
  assertEquals(out[0].chukta_counts, { properties: 3, workers: 12 })
})
