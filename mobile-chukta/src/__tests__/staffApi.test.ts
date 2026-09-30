import { createStaffApi, StaffApiError } from '../api/staffApi';

function api(status: number, body: unknown, token: string | null = 'tok') {
  const fetchFn = jest.fn(async () => ({ status, json: async () => body }));
  return { fetchFn, api: createStaffApi({ supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', accessToken: async () => token, fetchFn: fetchFn as unknown as typeof fetch }) };
}

const keyOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof StaffApiError ? e.key : `raw:${e}`));

test('create posts to /chukta-staff/create with the user token', async () => {
  const { fetchFn, api: a } = api(200, { staff: { id: 's1' } });
  await a.create({ propertyId: 'p', name: 'Mgr', pin: '4821' });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://x.supabase.co/functions/v1/chukta-staff/create');
  expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer tok' });
  expect(JSON.parse(init.body as string)).toEqual({ propertyId: 'p', name: 'Mgr', pin: '4821' });
});

test('maps server errors to i18n keys', async () => {
  expect(await keyOf(api(409, { error: 'pin_in_use' }).api.create({ propertyId: 'p', name: 'A', pin: '1111' }))).toBe('staff.error.pinInUse');
  expect(await keyOf(api(400, { error: 'pin_required_to_reactivate' }).api.update({ staffId: 's', isActive: true }))).toBe('staff.error.reactivateNeedsPin');
  expect(await keyOf(api(401, { error: 'unauthorized' }).api.unlock())).toBe('staff.error.sessionExpired');
  expect(await keyOf(api(500, { error: 'Internal error' }).api.unlock())).toBe('staff.error.unknown');
  expect(await keyOf(api(200, {}, null).api.unlock())).toBe('staff.error.sessionExpired');
});

test('network failure maps to staff.error.network', async () => {
  const a = createStaffApi({ supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', accessToken: async () => 't',
    fetchFn: (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch });
  expect(await keyOf(a.unlock())).toBe('staff.error.network');
});
