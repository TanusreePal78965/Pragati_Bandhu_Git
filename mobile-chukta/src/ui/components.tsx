import { Icon, type IconName } from './Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { NavigationContext } from '@react-navigation/native';
import { useContext, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../i18n/useT';
import { weekdayName } from '../utils/format';
import { colors, radius, shadows, space } from './theme';

const hasNativeLinearGradient = (): boolean => {
  try {
    if (typeof UIManager !== 'undefined' && typeof UIManager.getViewManagerConfig === 'function') {
      return Boolean(
        UIManager.getViewManagerConfig('ViewManagerAdapter_ExpoLinearGradient') ||
        UIManager.getViewManagerConfig('ExpoLinearGradient') ||
        UIManager.getViewManagerConfig('RCTViewManagerAdapter_ExpoLinearGradient')
      );
    }
  } catch {
    // fallback safely
  }
  return false;
};

const canUseLinearGradient = hasNativeLinearGradient();

export function Screen({
  children,
  refreshControl,
  header,
}: {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  header?: ReactNode;
}) {
  // Inside the tabs the tab bar already sits above the system navigation bar; elsewhere
  // (edge-to-edge stack screens) the content must clear it itself.
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={styles.screenContainer}>
      {header}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, !inTabs && { paddingBottom: space.xl * 2 + bottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  showBack,
  onBack,
  rightElement,
}: {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: ReactNode;
}) {
  // Not useNavigation(): that throws outside a NavigationContainer, and the first-run language
  // picker renders this header before the navigator mounts.
  const navigation = useContext(NavigationContext);
  const t = useT();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation?.canGoBack()) navigation.goBack();
  };

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          {showBack && (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          )}
          <View style={styles.headerTitleWrap}>
            {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : null}
            {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        {rightElement && <View style={styles.headerRight}>{rightElement}</View>}
      </View>
    </View>
  );
}

export function Card({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return <View style={[styles.card, style]} testID={testID}>{children}</View>;
}

export function HeroCard({
  children,
  variant = 'soft',
  style,
}: {
  children: ReactNode;
  variant?: 'primary' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  const cardStyle = [
    styles.card,
    variant === 'primary' ? styles.heroCardPrimary : styles.heroCardSoft,
    style,
  ];

  if (!canUseLinearGradient) {
    return <View style={cardStyle}>{children}</View>;
  }

  const gradientColors =
    variant === 'primary'
      ? ([colors.gradientStart, colors.gradientEnd] as const)
      : ([colors.gradientSoftStart, colors.gradientSoftEnd] as const);

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={cardStyle}
    >
      {children}
    </LinearGradient>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export const Title = ({
  children,
  testID,
  style,
}: {
  children: ReactNode;
  testID?: string;
  style?: StyleProp<TextStyle>;
}) => (
  <Text style={[styles.title, style]} testID={testID}>
    {children}
  </Text>
);

export const Label = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) => <Text style={[styles.label, style]}>{children}</Text>;

export const Muted = ({
  children,
  testID,
  style,
}: {
  children: ReactNode;
  testID?: string;
  style?: StyleProp<TextStyle>;
}) => (
  <Text style={[styles.muted, style]} testID={testID}>
    {children}
  </Text>
);

export function ErrorText({ children }: { children?: string | null }) {
  return children ? (
    <Text style={styles.error} accessibilityRole="alert">
      {children}
    </Text>
  ) : null;
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';
export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  testID,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const off = !!disabled || !!loading;
  const textColor =
    kind === 'primary'
      ? colors.primaryText
      : kind === 'danger'
        ? colors.dangerText
        : colors.primaryDark;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' && styles.buttonPrimary,
        kind === 'secondary' && styles.buttonSecondary,
        kind === 'danger' && styles.buttonDanger,
        pressed && !off && styles.buttonPressed,
        off && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...input
}: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.segment,
              on && styles.segmentOn,
              pressed && styles.segmentPressed,
            ]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const NO_DAY = -1;
/** Weekly-off picker; "None" (no weekly off) is null. */
export function WeekdayPicker({
  value,
  onChange,
  testIDPrefix = 'weekday',
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  testIDPrefix?: string;
}) {
  const t = useT();
  const options = [NO_DAY, 0, 1, 2, 3, 4, 5, 6].map((d) => ({
    value: d,
    label: weekdayName(d === NO_DAY ? null : d, t),
  }));
  return (
    <Segmented
      options={options}
      value={value ?? NO_DAY}
      onChange={(d) => onChange(d === NO_DAY ? null : d)}
      testIDPrefix={testIDPrefix}
    />
  );
}

export function Row({
  title,
  subtitle,
  right,
  left,
  onPress,
  onLongPress,
  selected,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  testID?: string;
}) {
  const body = (
    <View style={[styles.row, selected && styles.rowSelected]}>
      {left && <View style={styles.rowLeft}>{left}</View>}
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress && !onLongPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [pressed && styles.rowPressed]}
    >
      {body}
    </Pressable>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowTitle, styles.rowMain]}>{label}</Text>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={value ? colors.primaryDark : '#FFFFFF'}
      />
    </View>
  );
}

export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'off' | 'primary';

const STATUS_TONE_STYLES: Record<
  StatusTone,
  { bg: string; text: string; border: string; dot: string }
> = {
  success: {
    bg: colors.successSoft,
    text: colors.successText,
    border: colors.successBorder,
    dot: colors.success,
  },
  danger: {
    bg: colors.dangerSoft,
    text: colors.dangerText,
    border: colors.dangerBorder,
    dot: colors.danger,
  },
  warning: {
    bg: colors.warnSoft,
    text: colors.warnText,
    border: colors.warnBorder,
    dot: colors.warning,
  },
  info: {
    bg: colors.infoSoft,
    text: colors.infoText,
    border: colors.infoBorder,
    dot: colors.info,
  },
  off: {
    bg: colors.offSoft,
    text: colors.offText,
    border: colors.offBorder,
    dot: colors.off,
  },
  primary: {
    bg: colors.primarySoft,
    text: colors.primaryDark,
    border: colors.primaryBorder,
    dot: colors.primary,
  },
};

export function StatusChip({
  label,
  tone = 'primary',
  icon,
  testID,
  onPress,
}: {
  label: string;
  tone?: StatusTone;
  icon?: IconName;
  testID?: string;
  onPress?: () => void;
}) {
  const tStyle = STATUS_TONE_STYLES[tone];
  const chip = (
    <View
      style={[
        styles.chip,
        { backgroundColor: tStyle.bg, borderColor: tStyle.border },
      ]}
      testID={onPress ? undefined : testID}
    >
      {icon ? (
        <Icon name={icon} size={12} color={tStyle.text} style={styles.chipIcon} />
      ) : (
        <View style={[styles.chipDot, { backgroundColor: tStyle.dot }]} />
      )}
      <Text style={[styles.chipText, { color: tStyle.text }]}>{label}</Text>
    </View>
  );
  if (!onPress) return chip;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress}>
      {chip}
    </Pressable>
  );
}

// 6 harmonious accent colors for deterministic avatar coloring
const AVATAR_PALETTE = [
  { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }, // warm amber
  { bg: '#CFFAFE', text: '#155E75', border: '#A5F3FC' }, // deep cyan
  { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' }, // rose
  { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' }, // plum/violet
  { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' }, // emerald
  { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' }, // terracotta
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function Avatar({
  name,
  id,
  size = 36,
}: {
  name: string;
  id?: string;
  size?: number;
}) {
  const seed = id || name || '?';
  const colorIndex = stringHash(seed) % AVATAR_PALETTE.length;
  const theme = AVATAR_PALETTE[colorIndex];
  const initial = (name.trim()[0] || '?').toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.bg,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.avatarText, { color: theme.text, fontSize: size * 0.44 }]}>
        {initial}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Icon name={icon} size={36} color={colors.primary} />
      </View>
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {action && <View style={styles.emptyAction}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },

  // Screen header
  headerContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: space.sm,
  },
  backButton: {
    padding: space.xs,
    marginLeft: -space.xs,
    borderRadius: radius,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },

  // Cards
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  heroCardPrimary: {
    borderColor: colors.primaryDark,
    ...shadows.primary,
  },
  heroCardSoft: {
    borderColor: colors.primaryBorder,
    ...shadows.sm,
  },
  section: { gap: space.xs },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: space.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '500',
  },

  // Buttons
  button: {
    minHeight: 46,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  buttonDanger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.45,
    elevation: 0,
    shadowOpacity: 0,
  },

  // Inputs
  field: { gap: space.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    minHeight: 46,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft + '30',
  },

  // Segmented
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  segment: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  segmentPressed: {
    backgroundColor: colors.surfaceHover,
  },
  segmentOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    ...shadows.sm,
  },
  segmentText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  segmentTextOn: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowSelected: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  rowLeft: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },

  // Status Chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 4,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipIcon: {
    marginRight: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontWeight: '700',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  emptyAction: {
    marginTop: space.sm,
  },
});
