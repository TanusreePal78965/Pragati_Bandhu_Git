import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { PropertiesScreen } from '../screens/PropertiesScreen';
import { PropertyFormScreen } from '../screens/PropertyFormScreen';
import * as repos from '../repos/properties';
import { property } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen } from './helpers/session';

beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

test('owner picks a property from the list', async () => {
  const s = await makeSession(OWNER, { propertyId: null });
  await upsertLocal(s.db, 'properties', property({ id: 'p1', name: 'Hotel' }));
  await upsertLocal(s.db, 'properties', property({ id: 'p2', name: 'Farm' }));
  renderScreen('Properties', PropertiesScreen, s);
  fireEvent.press(await screen.findByTestId('property-p2'));
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalledWith('p2'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('Tabs');
});

test('a single active property is chosen automatically', async () => {
  const s = await makeSession(OWNER, { propertyId: null });
  await upsertLocal(s.db, 'properties', property({ id: 'p1' }));
  await upsertLocal(s.db, 'properties', property({ id: 'p9', name: 'Old', is_active: 0 }));
  renderScreen('Properties', PropertiesScreen, s);
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalledWith('p1'));
});

test('restoring an archived property warns about new staff PINs, then reactivates it', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, message, buttons) => {
    expect(message).toMatch(/new PIN/);
    void buttons?.[1]?.onPress?.();
  });
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property({ id: 'p1' }));
  await upsertLocal(s.db, 'properties', property({ id: 'p9', name: 'Old', is_active: 0 }));
  renderScreen('Properties', PropertiesScreen, s);
  fireEvent.press(await screen.findByTestId('restore-p9'));
  await waitFor(async () => expect((await s.db.getFirstAsync<{ is_active: number }>("select is_active from properties where id = 'p9'"))?.is_active).toBe(1));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('new property: created with the chosen defaults and selected when it is the first', async () => {
  const s = await makeSession(OWNER, { propertyId: null });
  renderScreen('PropertyForm', PropertyFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('name'), 'Hotel');
  fireEvent.press(screen.getByTestId('weekday-5'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalled());
  const row = await s.db.getFirstAsync<{ name: string; weekly_off: number; shop_id: string }>('select name, weekly_off, shop_id from properties');
  expect(row).toEqual({ name: 'Hotel', weekly_off: 5, shop_id: 'shop1' });
  const ops = await s.db.getAllAsync<{ op: string }>('select op from sync_queue order by seq');
  expect(ops.map((o) => o.op)).toEqual(['insert', 'update']);
});

test('property form shows validation errors', async () => {
  const s = await makeSession(OWNER);
  renderScreen('PropertyForm', PropertyFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('shift'), '0');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('Enter a property name.')).toBeTruthy();
  expect(screen.getByText('Shift hours must be more than 0 and at most 24.')).toBeTruthy();
});

test('archiving the current property clears the selection and returns to Properties', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { void buttons?.[1]?.onPress?.(); });
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property({ id: 'p1' }));
  renderScreen('PropertyForm', PropertyFormScreen, s, { propertyId: 'p1' });
  fireEvent.press(await screen.findByTestId('archive'));
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalledWith(null));
  expect((await s.db.getFirstAsync<{ is_active: number }>("select is_active from properties where id = 'p1'"))?.is_active).toBe(0);
});

test('a failed settings save after a successful create does not create a second property on retry', async () => {
  const s = await makeSession(OWNER, { propertyId: null });
  const spy = jest.spyOn(repos, 'updatePropertySettings').mockRejectedValueOnce(new Error('offline'));
  renderScreen('PropertyForm', PropertyFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('name'), 'Hotel');
  fireEvent.press(screen.getByTestId('save'));
  await screen.findByText('Could not save on this phone. Please try again.');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalled());
  spy.mockRestore();
  const rows = await s.db.getAllAsync<{ name: string }>('select name from properties');
  expect(rows).toEqual([{ name: 'Hotel' }]);
  const ops = await s.db.getAllAsync<{ op: string }>('select op from sync_queue order by seq');
  expect(ops.map((o) => o.op)).toEqual(['insert', 'update']);
});
