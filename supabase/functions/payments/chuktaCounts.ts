export type ChuktaCountRow = { shop_id: string; property_count: number; worker_count: number }
export type ChuktaCounts = { properties: number; workers: number }

export function withChuktaCounts<T extends { id: string }>(shops: T[], counts: ChuktaCountRow[]): (T & { chukta_counts: ChuktaCounts | null })[] {
  const byShop = new Map(counts.map((c) => [c.shop_id, { properties: Number(c.property_count), workers: Number(c.worker_count) }]))
  return shops.map((s) => ({ ...s, chukta_counts: byShop.get(s.id) ?? null }))
}
