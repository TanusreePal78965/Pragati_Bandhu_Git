import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useT } from '../i18n/useT';
import { LanguageRoute } from '../screens/LanguageScreen';
import { PropertiesScreen } from '../screens/PropertiesScreen';
import { PropertyFormScreen } from '../screens/PropertyFormScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
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
      {/* TABS */}
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
        {/* ROUTES */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
