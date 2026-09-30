import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { colors } from '../ui/theme';
import type { RootStackParamList, TabParamList } from './routes';
import { useSession } from './session';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

function Tabs() {
  const t = useT();
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      <Tab.Screen name="Today" component={TodayScreen} options={{ title: t('tabs.today'), tabBarIcon: icon('calendar-outline') }} />
      <Tab.Screen name="Workers" component={WorkersScreen} options={{ title: t('tabs.workers'), tabBarIcon: icon('people-outline') }} />
      <Tab.Screen name="Advances" component={AdvancesScreen} options={{ title: t('tabs.advances'), tabBarIcon: icon('wallet-outline') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline') }} />
    </Tab.Navigator>
  );
}

export function SessionNavigator() {
  const t = useT();
  const session = useSession();
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={session.identity.kind === 'owner' && !session.propertyId ? 'Properties' : 'Tabs'}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Language" component={LanguageRoute} options={{ title: t('language.title') }} />
        <Stack.Screen name="Properties" component={PropertiesScreen} options={{ title: t('properties.title') }} />
        <Stack.Screen name="PropertyForm" component={PropertyFormScreen} />
        <Stack.Screen name="WorkerDetail" component={WorkerDetailScreen} />
        <Stack.Screen name="WorkerForm" component={WorkerFormScreen} />
        <Stack.Screen name="MoneyEntry" component={MoneyEntryScreen} />
        <Stack.Screen name="StaffForm" component={StaffFormScreen} />
        <Stack.Screen name="SyncIssues" component={SyncIssuesScreen} options={{ title: t('syncIssues.title') }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
