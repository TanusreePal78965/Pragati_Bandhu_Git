import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../i18n/useT';
import { AdvancesScreen } from '../screens/AdvancesScreen';
import { LanguageRoute } from '../screens/LanguageScreen';
import { MoneyEntryScreen } from '../screens/MoneyEntryScreen';
import { PropertiesScreen } from '../screens/PropertiesScreen';
import { PropertyFormScreen } from '../screens/PropertyFormScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StaffFormScreen } from '../screens/StaffFormScreen';
import { SyncIssuesScreen } from '../screens/SyncIssuesScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkerDetailScreen } from '../screens/WorkerDetailScreen';
import { WorkerFormScreen } from '../screens/WorkerFormScreen';
import { WorkersScreen } from '../screens/WorkersScreen';
import { Icon, type IconName } from '../ui/Icon';
import { colors } from '../ui/theme';
import type { RootStackParamList, TabParamList } from './routes';
import { useSession } from './session';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcon = (name: IconName) => ({ color, size }: { color: string; size: number }) => (
  <Icon name={name} color={color} size={size} />
);

function Tabs() {
  const t = useT();
  // A fixed tabBarStyle height replaces bottom-tabs' own inset handling, so add the system
  // navigation bar inset back (edge-to-edge draws the app under it).
  const { bottom } = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + bottom,
          paddingBottom: 8 + bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ title: t('tabs.today'), tabBarIcon: tabIcon('calendar-outline') }}
      />
      <Tab.Screen
        name="Workers"
        component={WorkersScreen}
        options={{ title: t('tabs.workers'), tabBarIcon: tabIcon('people-outline') }}
      />
      <Tab.Screen
        name="Advances"
        component={AdvancesScreen}
        options={{ title: t('tabs.advances'), tabBarIcon: tabIcon('wallet-outline') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('tabs.settings'), tabBarIcon: tabIcon('settings-outline') }}
      />
    </Tab.Navigator>
  );
}

export function SessionNavigator() {
  const session = useSession();
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={session.identity.kind === 'owner' && !session.propertyId ? 'Properties' : 'Tabs'}
      >
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Language" component={LanguageRoute} />
        <Stack.Screen name="Properties" component={PropertiesScreen} />
        <Stack.Screen name="PropertyForm" component={PropertyFormScreen} />
        <Stack.Screen name="WorkerDetail" component={WorkerDetailScreen} />
        <Stack.Screen name="WorkerForm" component={WorkerFormScreen} />
        <Stack.Screen name="MoneyEntry" component={MoneyEntryScreen} />
        <Stack.Screen name="StaffForm" component={StaffFormScreen} />
        <Stack.Screen name="SyncIssues" component={SyncIssuesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
