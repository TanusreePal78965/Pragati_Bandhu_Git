jest.mock('../app/services', () => ({
  authService: {},
  staffApi: { create: jest.fn(async () => {}), update: jest.fn(async () => {}), unlock: jest.fn(async () => {}) },
}));

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { StaffApiError } from '../api/staffApi';
import { staffApi } from '../app/services';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StaffFormScreen } from '../screens/StaffFormScreen';
import { property } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

const api = staffApi as jest.Mocked<typeof staffApi>;
beforeAll(() => initI18n('en'));
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

async function ownerWithStaff() {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await s.db.runAsync(`insert into staff_users (id, property_id, name, auth_user_id, is_active, created_at) values
    ('11111111-1111-4111-8111-111111111111', 'p1', 'Mgr', 'a1', 1, 't'),
    ('22222222-2222-4222-8222-222222222222', 'p1', 'Old', 'a2', 0, 't')`);
  return s;
}

test('settings lists staff for owners, with help text and unlock', async () => {
  const s = await ownerWithStaff();
  renderScreen('Tabs', SettingsScreen, s);
  expect(await screen.findByText('Mgr')).toBeTruthy();
  expect(screen.getByText(/their own PIN/)).toBeTruthy();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  fireEvent.press(screen.getByTestId('unlock'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Unlock staff login', 'Staff login unlocked.'));
  expect(api.unlock).toHaveBeenCalled();
});

test('staff users do not see the staff section', async () => {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('Tabs', SettingsScreen, s);
  await screen.findByTestId('logout');
  expect(screen.queryByTestId('add-staff')).toBeNull();
});

test('add staff: validates, calls the API with the property, then syncs', async () => {
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('name'), 'Cashier');
  fireEvent.changeText(screen.getByTestId('pin'), '4821');
  fireEvent.changeText(screen.getByTestId('pin-confirm'), '4812');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText("PINs don't match.")).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('pin-confirm'), '4821');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(api.create).toHaveBeenCalledWith({ propertyId: 'p1', name: 'Cashier', pin: '4821' }));
  expect(s.runSync).toHaveBeenCalled();
});

test('server errors are shown in the form', async () => {
  api.create.mockRejectedValueOnce(new StaffApiError('staff.error.pinInUse'));
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('name'), 'X');
  fireEvent.changeText(screen.getByTestId('pin'), '1111');
  fireEvent.changeText(screen.getByTestId('pin-confirm'), '1111');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('Another staff member already uses this PIN.')).toBeTruthy();
});

test('reactivating needs a new PIN', async () => {
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s, { staffId: '22222222-2222-4222-8222-222222222222' });
  fireEvent(await screen.findByTestId('active'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('Set a new PIN to reactivate.')).toBeTruthy();
  expect(api.update).not.toHaveBeenCalled();
});

test('deactivating sends only isActive false', async () => {
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s, { staffId: '11111111-1111-4111-8111-111111111111' });
  fireEvent(await screen.findByTestId('active'), 'valueChange', false);
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith({ staffId: '11111111-1111-4111-8111-111111111111', isActive: false }));
});
