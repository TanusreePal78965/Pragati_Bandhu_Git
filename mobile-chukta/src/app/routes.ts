import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoneyKind } from '../view/moneyHistory';

export type RootStackParamList = {
  Tabs: undefined;
  Language: undefined;
  Properties: undefined;
  PropertyForm: { propertyId?: string } | undefined;
  Holidays: undefined;
  HolidayForm: { dayOffId?: string } | undefined;
  WorkerDetail: { workerId: string };
  WorkerForm: { workerId?: string } | undefined;
  MoneyEntry: { workerId: string; kind: MoneyKind };
  StaffForm: { staffId?: string } | undefined;
  SyncIssues: undefined;
};
export type TabParamList = { Today: undefined; Workers: undefined; Advances: undefined; Settings: undefined };

/** Stack navigation from any screen (tab screens bubble stack routes up to the root stack). */
export const useStackNav = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();
