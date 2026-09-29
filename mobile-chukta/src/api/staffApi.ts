export type StaffApiErrorKey =
  | 'staff.error.pinInUse' | 'staff.error.reactivateNeedsPin' | 'staff.error.network'
  | 'staff.error.sessionExpired' | 'staff.error.unknown';

export class StaffApiError extends Error {
  constructor(public key: StaffApiErrorKey) {
    super(key);
  }
}

export type StaffApi = {
  create(input: { propertyId: string; name: string; pin: string }): Promise<void>;
  update(input: { staffId: string; name?: string; pin?: string; isActive?: boolean }): Promise<void>;
  /** Clears the shop's staff-PIN lockout. */
  unlock(): Promise<void>;
};

const ERRORS: Record<string, StaffApiErrorKey> = {
  pin_in_use: 'staff.error.pinInUse',
  pin_required_to_reactivate: 'staff.error.reactivateNeedsPin',
};

export function createStaffApi(deps: {
  supabaseUrl: string; anonKey: string; accessToken(): Promise<string | null>; fetchFn?: typeof fetch;
}): StaffApi {
  const fetchFn = deps.fetchFn ?? fetch;
  async function call(route: 'create' | 'update' | 'unlock', body: unknown): Promise<void> {
    const token = await deps.accessToken();
    if (!token) throw new StaffApiError('staff.error.sessionExpired');
    let res: { status: number; json(): Promise<any> };
    try {
      res = await fetchFn(`${deps.supabaseUrl}/functions/v1/chukta-staff/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: deps.anonKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new StaffApiError('staff.error.network');
    }
    if (res.status === 200) return;
    const payload = await res.json().catch(() => null);
    if (res.status === 401) throw new StaffApiError('staff.error.sessionExpired');
    throw new StaffApiError(ERRORS[payload?.error] ?? 'staff.error.unknown');
  }
  return {
    create: (input) => call('create', input),
    update: (input) => call('update', input),
    unlock: () => call('unlock', {}),
  };
}
