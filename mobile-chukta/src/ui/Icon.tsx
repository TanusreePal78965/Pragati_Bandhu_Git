import React from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';

export type IconName =
  | 'arrow-back'
  | 'calendar-outline'
  | 'people-outline'
  | 'wallet-outline'
  | 'settings-outline'
  | 'time-outline'
  | 'checkmark-circle-outline'
  | 'alert-circle-outline'
  | 'close-circle-outline'
  | 'business-outline'
  | 'person-outline'
  | 'sync-outline'
  | 'cloud-done-outline'
  | 'cash-outline'
  | 'trash-outline'
  | 'create-outline'
  | 'refresh-outline';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

let IoniconsComponent: React.ComponentType<any>;

// In Jest test environment, avoid loading expo-font/expo-asset which isn't bundled for Node test runner
if (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined)) {
  IoniconsComponent = ({ name, size = 24, style }: IconProps) => (
    <View accessibilityRole="image" accessibilityLabel={name} style={[{ width: size, height: size }, style]} />
  );
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IoniconsComponent = require('@expo/vector-icons').Ionicons;
}

export const Icon: React.ComponentType<IconProps> = IoniconsComponent;
