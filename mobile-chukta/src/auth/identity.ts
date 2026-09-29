export type Identity =
  | { kind: 'owner'; userId: string; shopId: string; phone: string }
  | { kind: 'staff'; userId: string; staffId: string; staffName: string; propertyId: string; propertyName: string };

/** Database-file key: owner data and each staff member's data never share a local database. */
export function identityKey(i: Identity): string {
  return i.kind === 'owner' ? `owner_${i.shopId}` : `staff_${i.staffId}`;
}
