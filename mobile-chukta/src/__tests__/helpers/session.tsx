import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Text } from 'react-native';
import type { RootStackParamList } from '../../app/routes';
import { SessionContext, type Session } from '../../app/session';
import type { Identity } from '../../auth/identity';
import { migrate } from '../../db/schema';
import { openTestDb } from '../../db/testing/betterSqliteDb';
import { IDLE_STATUS } from '../../sync/engine';

export const OWNER: Identity = { kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+919800000001' };
export const STAFF: Identity = { kind: 'staff', userId: 'u2', staffId: 'st1', staffName: 'Mgr', propertyId: 'p1', propertyName: 'Main' };

export const ALL_ROUTES: (keyof RootStackParamList)[] = [
  'Tabs', 'Language', 'Properties', 'PropertyForm', 'Holidays', 'HolidayForm', 'WorkerDetail', 'WorkerForm', 'MoneyEntry', 'StaffForm', 'SyncIssues',
];

/** A real SQLite-backed session (in memory) with jest.fn() side effects. "Today" is 2026-09-07 (a Monday). */
export async function makeSession(identity: Identity = OWNER, over: Partial<Session> = {}): Promise<Session> {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  return {
    identity,
    db,
    repo: {
      db, userId: identity.userId, role: identity.kind, now: () => new Date(2026, 8, 7, 10, 0),
      newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    },
    propertyId: identity.kind === 'staff' ? identity.propertyId : 'p1',
    setPropertyId: jest.fn(async () => {}),
    version: 0,
    syncStatus: IDLE_STATUS,
    runSync: jest.fn(async () => {}),
    afterWrite: jest.fn(),
    logout: jest.fn(async () => {}),
    ...over,
  };
}

function Blank({ route }: { route: { name: string } }) {
  return <Text testID="current-route">{route.name}</Text>;
}

/**
 * Renders one screen under its real route name; every other route is a stub that shows its name (testID "current-route").
 * A pushed screen (anything but Tabs) sits on top of a stub Tabs route, so its `goBack()` lands on "Tabs" as in the app.
 */
export function renderScreen(name: keyof RootStackParamList, Screen: ComponentType<any>, session: Session, params?: object) {
  const Stack = createNativeStackNavigator();
  const initialState = name === 'Tabs' ? undefined : { index: 1, routes: [{ name: 'Tabs' }, { name, params }] };
  const tree = (s: Session) => (
    <SessionContext.Provider value={s}>
      <NavigationContainer initialState={initialState}>
        <Stack.Navigator initialRouteName={name}>
          {ALL_ROUTES.map((r) => (
            <Stack.Screen key={r} name={r} component={r === name ? Screen : Blank} initialParams={r === name ? params : undefined} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </SessionContext.Provider>
  );
  const utils = render(tree(session));
  return { ...utils, rerenderWith: (s: Session) => utils.rerender(tree(s)) };
}
